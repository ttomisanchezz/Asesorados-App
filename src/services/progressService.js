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

  // Las filas vienen newest-first; para el gráfico las queremos oldest-first.
  const ordered = [...data].reverse()
  const withWeight = ordered.filter((r) => r.weight != null)
  const label = (iso) =>
    new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })

  const latest = data[0] // fila más reciente
  return {
    weightHistory: withWeight.map((r) => Number(r.weight)),
    dates: withWeight.map((r) => label(r.created_at)),
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
export async function getProgressMetrics(clientId, limit = 20) {
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
