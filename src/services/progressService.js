import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { mockClients } from '../data/mockClients'

// ---------------------------------------------------------------------------
// Normaliza las filas reales de progress_metrics (snake_case, una por medición)
// al shape agregado que espera el UI: { weightHistory[], dates[], measurements }.
// Si ya viene en formato mock (objeto con weightHistory), se devuelve intacto.
// ---------------------------------------------------------------------------
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

  const latest = ordered[ordered.length - 1] // fila más reciente por fecha
  return {
    count: ordered.length,
    weightHistory: withWeight.map((r) => Number(r.weight)),
    dates: withWeight.map((r) => label(r.created_at)),
    // points: serie limpia para el gráfico/estadísticas
    points: withWeight.map((r) => ({ weight: Number(r.weight), iso: r.created_at })),
    measurements: {
      waist: latest.waist ?? null,
      chest: latest.chest ?? null,
      hip: latest.hip ?? null,
      arm: latest.arm ?? null,
      leg: latest.leg ?? null,
    },
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
