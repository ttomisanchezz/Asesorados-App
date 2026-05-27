import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { mockClients } from '../data/mockClients'

function normalizeWorkoutPlan(raw) {
  if (!raw) return null
  if (raw.plan !== undefined) return raw // ya normalizado (mock)
  return {
    plan:      raw.title ?? '',
    days:      raw.days ?? [],
    exercises: raw.exercises ?? [],
    notes:     raw.notes ?? '',
  }
}

/**
 * Retorna la rutina activa de un cliente.
 */
export async function getWorkoutPlan(clientId) {
  if (!isSupabaseConfigured) {
    const client = mockClients.find((c) => c.id === clientId)
    return { data: client?.training ?? null, error: null, source: 'mock' }
  }

  const { data, error } = await supabase
    .from('workout_plans')
    .select('*')
    .eq('client_id', clientId)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return { data: error ? null : normalizeWorkoutPlan(data), error, source: 'supabase' }
}

/**
 * Retorna la rutina del asesorado autenticado.
 */
export async function getMyWorkoutPlan() {
  if (!isSupabaseConfigured) {
    const client = mockClients.find((c) => c.status === 'active')
    return { data: client?.training ?? null, error: null, source: 'mock' }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: new Error('No autenticado'), source: 'supabase' }

  const { data: clientData } = await supabase
    .from('clients')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!clientData) return { data: null, error: new Error('Perfil no encontrado'), source: 'supabase' }

  const { data, error } = await supabase
    .from('workout_plans')
    .select('*')
    .eq('client_id', clientData.id)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return { data: error ? null : normalizeWorkoutPlan(data), error, source: 'supabase' }
}

/**
 * Crea o actualiza la rutina de un cliente.
 */
export async function upsertWorkoutPlan(clientId, payload) {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error('Requiere Supabase configurado') }
  }

  const { data: { user } } = await supabase.auth.getUser()

  await supabase
    .from('workout_plans')
    .update({ active: false })
    .eq('client_id', clientId)
    .eq('active', true)

  const { data, error } = await supabase
    .from('workout_plans')
    .insert({
      ...payload,
      client_id: clientId,
      coach_id: user.id,
      active: true,
    })
    .select()
    .single()

  return { data, error }
}
