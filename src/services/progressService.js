import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { mockClients } from '../data/mockClients'

// ---------------------------------------------------------------------------
// Normaliza las filas reales de progress_metrics (snake_case, una por medición)
// al shape agregado que espera el UI: { weightHistory[], dates[], measurements }.
// Si ya viene en formato mock (objeto con weightHistory), se devuelve intacto.
// ---------------------------------------------------------------------------
const MEASUREMENT_FIELDS = ['waist', 'chest', 'hip', 'arm', 'leg']

function normalizeProgress(data) {
  if (!data) return null
  if (!Array.isArray(data)) return data.weightHistory ? data : null
  if (data.length === 0) return null

  // Orden cronológico real: ascendente por created_at (la fecha del registro).
  const ordered = [...data].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at),
  )
  const withWeight = ordered.filter((r) => r.weight != null)
  const label = (iso) =>
    new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })

  // Última medida POR CAMPO: un registro nuevo de solo-peso no debe "borrar"
  // las medidas previas en la vista.
  const latestOf = (field) => {
    for (let i = ordered.length - 1; i >= 0; i--) {
      if (ordered[i][field] != null) return Number(ordered[i][field])
    }
    return null
  }

  return {
    count: ordered.length,
    weightHistory: withWeight.map((r) => Number(r.weight)),
    dates: withWeight.map((r) => label(r.created_at)),
    // points: serie limpia para el gráfico/estadísticas (incluye id para poder editar por registro)
    points: withWeight.map((r) => ({ id: r.id, weight: Number(r.weight), iso: r.created_at, notes: r.notes ?? null })),
    measurements: Object.fromEntries(MEASUREMENT_FIELDS.map((f) => [f, latestOf(f)])),
    // measurementPoints: historial de mediciones (solo filas con alguna medida),
    // ascendente por fecha — para listas/series de cintura, pecho, brazo, etc.
    measurementPoints: ordered
      .filter((r) => MEASUREMENT_FIELDS.some((f) => r[f] != null))
      .map((r) => ({
        id: r.id,
        iso: r.created_at,
        ...Object.fromEntries(
          MEASUREMENT_FIELDS.map((f) => [f, r[f] != null ? Number(r[f]) : null]),
        ),
      })),
    entries: ordered,
  }
}

/**
 * Retorna el historial de métricas de progreso de un cliente (normalizado).
 */
export async function getProgressMetrics(clientId, limit = 365) {
  if (!isSupabaseConfigured) {
    const client = mockClients.find((c) => c.id === clientId)
    return { data: normalizeProgress(client?.progress ?? null), error: null, source: 'mock' }
  }

  const { data, error } = await supabase
    .from('progress_metrics')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return { data: error ? null : normalizeProgress(data), error, source: 'supabase' }
}

/**
 * Retorna el progreso del asesorado autenticado.
 */
export async function getMyProgress() {
  if (!isSupabaseConfigured) {
    const client = mockClients.find((c) => c.status === 'active')
    return { data: normalizeProgress(client?.progress ?? null), error: null, source: 'mock' }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: new Error('No autenticado'), source: 'supabase' }

  const { data: clientData } = await supabase
    .from('clients')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!clientData) return { data: null, error: null, source: 'supabase' }

  return getProgressMetrics(clientData.id)
}

/**
 * El asesorado autenticado registra (o actualiza) su propio peso del día.
 *
 * Seguridad:
 *   - Usa el usuario autenticado; resuelve client_id y coach_id REALES desde la
 *     fila de `clients` (clients.user_id = auth.uid()). Nunca hardcodea IDs.
 *   - No usa service_role: corre con la sesión del navegador y la anon key.
 *   - La escritura final la autoriza RLS. Si el asesorado no tiene policy de
 *     INSERT/UPDATE sobre progress_metrics, Supabase rechaza la operación
 *     (no se saltea RLS desde acá).
 *
 * @param {{ weight:number, date:string, notes?:string }} payload  date = 'YYYY-MM-DD'
 * @returns {{ data, error, updated }}  updated=true si se actualizó un registro existente de esa fecha
 */
export async function addMyProgressEntry({ weight, date, notes }) {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error('Requiere Supabase configurado'), updated: false }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: new Error('No autenticado'), updated: false }

  const { data: client, error: cErr } = await supabase
    .from('clients')
    .select('id, coach_id')
    .eq('user_id', user.id)
    .single()
  if (cErr || !client) {
    // Sin client vinculado al usuario: no es un problema de permisos, es que
    // todavía no existe la relación clients.user_id = auth.uid().
    return { data: null, error: cErr || new Error('Perfil no encontrado'), updated: false, reason: 'no-client' }
  }

  // ¿Ya hay un registro para ese día? (no duplicar)
  const dayStart = `${date}T00:00:00.000Z`
  const dayEnd = `${date}T23:59:59.999Z`
  const { data: existing } = await supabase
    .from('progress_metrics')
    .select('id')
    .eq('client_id', client.id)
    .gte('created_at', dayStart)
    .lte('created_at', dayEnd)
    .limit(1)

  const updating = Array.isArray(existing) && existing.length > 0
  let result
  if (updating) {
    result = await supabase
      .from('progress_metrics')
      .update({ weight, notes: notes || null })
      .eq('id', existing[0].id)
      .select()
      .single()
  } else {
    result = await supabase
      .from('progress_metrics')
      .insert({
        client_id: client.id,
        coach_id: client.coach_id,
        weight,
        notes: notes || null,
        created_at: `${date}T12:00:00.000Z`,
      })
      .select()
      .single()
  }
  if (result.error) return { data: null, error: result.error, updated: updating }

  // clients.weight (peso denormalizado) lo sincroniza el trigger
  // sync_client_weight en la DB de forma segura — no hace falta tocarlo desde acá.
  return { data: result.data, error: null, updated: updating }
}

/**
 * El asesorado autenticado registra sus mediciones corporales (cm) del día.
 *
 * Mismo patrón que addMyProgressEntry: resuelve client_id/coach_id reales desde
 * clients (user_id = auth.uid()), nunca service_role, y RLS autoriza la
 * escritura. Si ya existe un registro de progress_metrics para esa fecha, se
 * actualizan solo los campos provistos (el peso del día no se toca); si no,
 * se inserta una fila nueva. Así peso y medidas comparten el historial.
 *
 * @param {{ date:string, waist?:number, chest?:number, arm?:number, hip?:number, leg?:number }} payload
 *        date = 'YYYY-MM-DD'; medidas en cm (solo se guardan las provistas)
 * @returns {{ data, error, updated, reason? }}
 */
export async function addMyMeasurements({ date, waist, chest, arm, hip, leg }) {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error('Requiere Supabase configurado'), updated: false }
  }

  const patch = {}
  for (const [field, value] of Object.entries({ waist, chest, arm, hip, leg })) {
    if (value != null) patch[field] = value
  }
  if (Object.keys(patch).length === 0) {
    return { data: null, error: new Error('Cargá al menos una medida.'), updated: false }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: new Error('No autenticado'), updated: false }

  const { data: client, error: cErr } = await supabase
    .from('clients')
    .select('id, coach_id')
    .eq('user_id', user.id)
    .single()
  if (cErr || !client) {
    return { data: null, error: cErr || new Error('Perfil no encontrado'), updated: false, reason: 'no-client' }
  }

  // ¿Ya hay un registro para ese día? (peso y medidas comparten la fila diaria)
  const dayStart = `${date}T00:00:00.000Z`
  const dayEnd = `${date}T23:59:59.999Z`
  const { data: existing } = await supabase
    .from('progress_metrics')
    .select('id')
    .eq('client_id', client.id)
    .gte('created_at', dayStart)
    .lte('created_at', dayEnd)
    .limit(1)

  const updating = Array.isArray(existing) && existing.length > 0
  let result
  if (updating) {
    result = await supabase
      .from('progress_metrics')
      .update(patch)
      .eq('id', existing[0].id)
      .select()
      .single()
  } else {
    result = await supabase
      .from('progress_metrics')
      .insert({
        client_id: client.id,
        coach_id: client.coach_id,
        ...patch,
        created_at: `${date}T12:00:00.000Z`,
      })
      .select()
      .single()
  }
  if (result.error) return { data: null, error: result.error, updated: updating }
  return { data: result.data, error: null, updated: updating }
}

/**
 * El asesorado autenticado corrige el peso de UN registro existente (por id).
 *
 * Se usa para enmendar cargas erróneas (ej. 242 kg) sin crear un duplicado:
 * hace UPDATE sobre la misma fila de progress_metrics. La autorización la da
 * RLS (policy "progress: asesorado actualiza el suyo"): solo puede tocar filas
 * de un client cuyo user_id = auth.uid(). No usa service_role.
 *
 * @param {{ id:string, weight:number, notes?:string }} payload
 * @returns {{ data, error }}
 */
export async function updateMyProgressWeight({ id, weight, notes }) {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error('Requiere Supabase configurado') }
  }
  if (!id) return { data: null, error: new Error('Falta el id del registro') }

  const patch = { weight }
  if (notes !== undefined) patch.notes = notes?.trim() || null

  const { data, error } = await supabase
    .from('progress_metrics')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  // El trigger sync_client_weight mantiene clients.weight = último peso real.
  return { data, error }
}

/**
 * Registra una nueva métrica de progreso.
 */
export async function addProgressEntry(clientId, payload) {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error('Requiere Supabase configurado') }
  }

  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('progress_metrics')
    .insert({
      ...payload,
      client_id: clientId,
      coach_id: user.id,
    })
    .select()
    .single()

  return { data, error }
}
