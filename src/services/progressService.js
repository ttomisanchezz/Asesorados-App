import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { mockClients } from '../data/mockClients'

/**
 * Retorna el historial de métricas de progreso de un cliente.
 */
export async function getProgressMetrics(clientId, limit = 20) {
  if (!isSupabaseConfigured) {
    const client = mockClients.find((c) => c.id === clientId)
    return { data: client?.progress ?? null, error: null, source: 'mock' }
  }

  const { data, error } = await supabase
    .from('progress_metrics')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return { data, error, source: 'supabase' }
}

/**
 * Retorna el progreso del asesorado autenticado.
 */
export async function getMyProgress() {
  if (!isSupabaseConfigured) {
    const client = mockClients.find((c) => c.status === 'active')
    return { data: client?.progress ?? null, error: null, source: 'mock' }
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
