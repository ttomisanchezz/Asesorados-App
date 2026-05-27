import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { mockClients } from '../data/mockClients'

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
    // Relaciones — se cargan por separado si es necesario
    nutrition:           null,
    training:            null,
    progress:            null,
  }
}

// ---------------------------------------------------------------------------

/**
 * Retorna la lista de clientes del coach autenticado.
 * Fallback: mock data cuando Supabase no está configurado.
 */
export async function getClients() {
  if (!isSupabaseConfigured) {
    return { data: mockClients, error: null, source: 'mock' }
  }

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('full_name', { ascending: true })

  return {
    data: error ? null : (data ?? []).map(normalizeClient),
    error,
    source: 'supabase',
  }
}

/**
 * Retorna un cliente por ID con sus relaciones principales.
 */
export async function getClientById(id) {
  if (!isSupabaseConfigured) {
    const client = mockClients.find((c) => c.id === id)
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
    data: error ? null : normalizeClient(data),
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
    data: error ? null : normalizeClient(data),
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
 * Actualiza un cliente existente.
 */
export async function updateClient(id, payload) {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error('Requiere Supabase configurado') }
  }

  const { data, error } = await supabase
    .from('clients')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  return { data, error }
}
