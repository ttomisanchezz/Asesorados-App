import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { mockClients } from '../data/mockClients'
import { demoWorkoutHistory } from '../data/demoRuntime'

function demoHistory(clientId) {
  if (!demoWorkoutHistory.has(clientId)) {
    const source = mockClients.find((client) => client.id === clientId)?.training
    demoWorkoutHistory.set(clientId, source ? [{ ...source, id: `demo-workout-${clientId}`, active: true, createdAt: new Date().toISOString() }] : [])
  }
  return demoWorkoutHistory.get(clientId)
}

export function normalizeWorkoutPlan(raw) {
  if (!raw) return null
  if (raw.plan !== undefined) return raw // ya normalizado (mock)
  return {
    id:        raw.id ?? null,
    clientId:  raw.client_id ?? null,
    plan:      raw.title ?? '',
    days:      raw.days ?? [],
    exercises: raw.exercises ?? [],
    notes:     raw.notes ?? '',
    active:    raw.active ?? false,
    createdAt: raw.created_at ?? null,
    updatedAt: raw.updated_at ?? null,
  }
}

function workoutPayload(payload) {
  return {
    title: payload.title?.trim() || payload.plan?.trim() || null,
    days: payload.days ?? [],
    exercises: payload.exercises ?? [],
    notes: payload.notes?.trim() || null,
  }
}

/**
 * Retorna la rutina activa de un cliente.
 */
export async function getWorkoutPlan(clientId) {
  if (!isSupabaseConfigured) {
    return { data: demoHistory(clientId).find((plan) => plan.active) ?? null, error: null, source: 'mock' }
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
export async function createWorkoutPlanVersion(clientId, payload) {
  if (!isSupabaseConfigured) {
    const history = demoHistory(clientId)
    history.forEach((plan) => { plan.active = false })
    const created = { ...payload, plan: payload.title || payload.plan || '', id: `demo-workout-${Date.now()}`, active: true, createdAt: new Date().toISOString() }
    history.unshift(created)
    return { data: created, error: null, source: 'mock' }
  }

  const clean = workoutPayload(payload)
  const { data, error } = await supabase.rpc('create_workout_plan_version', {
    p_client_id: clientId,
    p_title: clean.title,
    p_days: clean.days,
    p_exercises: clean.exercises,
    p_notes: clean.notes,
  })

  return { data: error ? null : normalizeWorkoutPlan(data), error }
}

/** Historial completo, con la versión activa primero y luego por fecha. */
export async function getWorkoutPlanHistory(clientId) {
  if (!isSupabaseConfigured) {
    return { data: [...demoHistory(clientId)], error: null, source: 'mock' }
  }

  const { data, error } = await supabase
    .from('workout_plans')
    .select('*')
    .eq('client_id', clientId)
    .order('active', { ascending: false })
    .order('created_at', { ascending: false })

  return { data: error ? [] : (data ?? []).map(normalizeWorkoutPlan), error, source: 'supabase' }
}

/** Edita una versión existente sin activarla ni alterar el resto del historial. */
export async function updateWorkoutPlanVersion(planId, payload) {
  if (!isSupabaseConfigured) {
    for (const history of demoWorkoutHistory.values()) {
      const index = history.findIndex((plan) => plan.id === planId)
      if (index >= 0) {
        history[index] = { ...history[index], ...payload, plan: payload.title || payload.plan || history[index].plan, updatedAt: new Date().toISOString() }
        return { data: history[index], error: null, source: 'mock' }
      }
    }
    return { data: null, error: new Error('Rutina no encontrada'), source: 'mock' }
  }

  const { data, error } = await supabase
    .from('workout_plans')
    .update(workoutPayload(payload))
    .eq('id', planId)
    .select()
    .single()

  return { data: error ? null : normalizeWorkoutPlan(data), error }
}

/** Alias conservado para consumidores existentes. */
export async function upsertWorkoutPlan(clientId, payload) {
  return createWorkoutPlanVersion(clientId, payload)
}
