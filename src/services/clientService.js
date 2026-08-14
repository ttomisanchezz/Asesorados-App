import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { mockClients } from '../data/mockClients'
import { getWeeklyAdherenceMap } from './adherenceService'
import { sortClientsByWeeklyActivity } from '../lib/clientRanking'
import { demoClients, demoNutritionHistory, demoWorkoutHistory } from '../data/demoRuntime'

const demoClientOverrides = new Map()

function demoView(client) {
  return client ? { ...client, ...(demoClientOverrides.get(client.id) ?? {}) } : null
}

function extractWeightRange(notes) {
  const match = String(notes ?? '').match(
    /peso informado:\s*(\d+(?:[.,]\d+)?)\s*[\u2013-]\s*(\d+(?:[.,]\d+)?)\s*kg/i,
  )
  if (!match) return null
  return `${match[1].replace(',', '.')}–${match[2].replace(',', '.')}`
}

// ---------------------------------------------------------------------------
// Normalización: convierte snake_case de Supabase al formato camelCase del UI.
// Los mocks ya vienen en el formato correcto, por eso este step solo aplica
// a datos reales de Supabase.
// ---------------------------------------------------------------------------
function normalizeClient(raw) {
  if (!raw) return null
  // Si ya tiene 'name' (mock) lo dejamos pasar intacto
  if (raw.name !== undefined) return raw

  return {
    id:                  raw.id,
    name:                raw.full_name ?? '',
    avatar:              raw.avatar_initials
                           ?? raw.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                           ?? '??',
    avatarColor:         raw.avatar_color ?? '#6c63ff',
    age:                 raw.age,
    gender:              raw.gender ?? '',
    email:               raw.email ?? '',
    phone:               raw.phone ?? '',
    objective:           raw.objective ?? '',
    status:              raw.status ?? 'active',
    weight:              raw.weight,
    weightRange:         extractWeightRange(raw.internal_notes),
    targetWeight:        raw.target_weight,
    height:              raw.height,
    experience:          raw.experience ?? '',
    availableDays:       raw.available_days ?? [],
    limitations:         raw.limitations ?? '',
    internalNotes:       raw.internal_notes ?? '',
    adherenceNutrition:  raw.adherence_nutrition ?? 0,
    adherenceTraining:   raw.adherence_training ?? 0,
    lastCheckin:         raw.last_checkin ?? null,
    nextReview:          raw.next_review ?? null,
    weeklyGoal:          raw.weekly_goal ?? '',
    startDate:           raw.created_at?.slice(0, 10) ?? '',
    updatedAt:           raw.updated_at ?? null,
    // Relaciones — se cargan por separado si es necesario
    nutrition:           null,
    training:            null,
    progress:            null,
  }
}

// ---------------------------------------------------------------------------
// Las columnas adherence_* de clients son estáticas (nadie las recalcula):
// acá se pisan con la adherencia semanal calculada desde los registros reales
// (workout_sessions / nutrition_compliance / check-ins). Si el cálculo no tiene
// datos (o falla), se conserva el valor de la ficha para no romper la vista.
// ---------------------------------------------------------------------------
async function withWeeklyAdherence(clients) {
  const list = (Array.isArray(clients) ? clients : [clients]).filter(Boolean)
  if (list.length === 0) return clients
  try {
    const map = await getWeeklyAdherenceMap(list.map((c) => c.id))
    for (const c of list) {
      const adh = map[c.id]
      if (!adh) continue
      if (adh.nutrition != null) c.adherenceNutrition = adh.nutrition
      if (adh.training != null) c.adherenceTraining = adh.training
      if (adh.trainingDone > 0 || adh.trainingPlanned > 0) {
        c.weeklyTraining = { done: adh.trainingDone, planned: adh.trainingPlanned }
      }
      if (adh.lastActivityAt) c.lastActivityAt = adh.lastActivityAt
    }
  } catch {
    // Sin adherencia calculada: la vista sigue con los valores de la ficha.
  }
  return clients
}

// ---------------------------------------------------------------------------

/**
 * Retorna la lista de clientes del coach autenticado.
 * Fallback: mock data cuando Supabase no está configurado.
 */
export async function getClients() {
  if (!isSupabaseConfigured) {
    return { data: sortClientsByWeeklyActivity([...demoClients, ...mockClients].map(demoView)), error: null, source: 'mock' }
  }

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('full_name', { ascending: true })

  const normalized = error ? null : await withWeeklyAdherence((data ?? []).map(normalizeClient))
  return {
    data: error ? null : sortClientsByWeeklyActivity(normalized),
    error,
    source: 'supabase',
  }
}

/**
 * Retorna un cliente por ID con sus relaciones principales.
 */
export async function getClientById(id) {
  if (!isSupabaseConfigured) {
    const client = demoView([...demoClients, ...mockClients].find((c) => c.id === id))
    return {
      data: client ?? null,
      error: client ? null : new Error('Cliente no encontrado'),
      source: 'mock',
    }
  }

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single()

  return {
    data: error ? null : await withWeeklyAdherence(normalizeClient(data)),
    error,
    source: 'supabase',
  }
}

/**
 * Retorna el perfil del asesorado autenticado (su propio registro).
 * Usa user_id = auth.uid() para que el asesorado solo vea sus datos.
 */
export async function getMyClientProfile() {
  if (!isSupabaseConfigured) {
    const client = mockClients.find((c) => c.status === 'active')
    return { data: client ?? null, error: null, source: 'mock' }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: new Error('No autenticado'), source: 'supabase' }

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return {
    data: error ? null : await withWeeklyAdherence(normalizeClient(data)),
    error,
    source: 'supabase',
  }
}

/**
 * Crea un nuevo cliente.
 */
export async function createClient(payload) {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error('Requiere Supabase configurado') }
  }

  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('clients')
    .insert({ ...payload, coach_id: user.id })
    .select()
    .single()

  return { data, error }
}

/**
 * Alta completa: ficha, acceso de Auth y planes iniciales. La clave de servicio
 * vive exclusivamente dentro de la Edge Function create-client.
 */
export async function createClientWithAccess(payload) {
  if (!isSupabaseConfigured) {
    const raw = payload.client ?? {}
    const now = new Date().toISOString()
    const created = normalizeClient({
      id: `demo-${Date.now()}`,
      ...raw,
      created_at: now,
      updated_at: now,
    })
    created.nutrition = payload.nutritionPlan ?? null
    created.training = payload.workoutPlan ?? null
    demoClients.unshift(created)
    if (payload.nutritionPlan) demoNutritionHistory.set(created.id, [{
      ...payload.nutritionPlan, id: `demo-nutrition-${created.id}`, active: true,
      createdAt: now, lastUpdate: now.slice(0, 10),
    }])
    if (payload.workoutPlan) demoWorkoutHistory.set(created.id, [{
      ...payload.workoutPlan, plan: payload.workoutPlan.title || payload.workoutPlan.plan || '',
      id: `demo-workout-${created.id}`, active: true, createdAt: now,
    }])
    return { data: { client: created, username: payload.username }, error: null, source: 'mock' }
  }

  const { data, error } = await supabase.functions.invoke('create-client', { body: payload })
  const functionError = error || (data?.error ? new Error(data.error) : null)
  return {
    data: functionError ? null : { ...data, client: normalizeClient(data.client) },
    error: functionError,
    source: 'supabase',
  }
}

/**
 * Actualiza un cliente existente.
 */
export async function updateClient(id, payload) {
  if (!isSupabaseConfigured) {
    const source = [...demoClients, ...mockClients].find((c) => c.id === id)
    if (!source) return { data: null, error: new Error('Cliente no encontrado') }
    const patch = {
      name: payload.full_name, email: payload.email, phone: payload.phone,
      objective: payload.objective, age: payload.age, gender: payload.gender,
      weight: payload.weight, targetWeight: payload.target_weight, height: payload.height,
      experience: payload.experience, availableDays: payload.available_days,
      limitations: payload.limitations, internalNotes: payload.internal_notes,
      weeklyGoal: payload.weekly_goal, nextReview: payload.next_review,
      lastCheckin: payload.last_checkin, status: payload.status,
      avatar: payload.avatar_initials, avatarColor: payload.avatar_color,
      updatedAt: new Date().toISOString(),
    }
    demoClientOverrides.set(id, patch)
    return { data: { ...source, ...patch }, error: null, source: 'mock' }
  }

  const { data, error } = await supabase
    .from('clients')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  return { data, error }
}
