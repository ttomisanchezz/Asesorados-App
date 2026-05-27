import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { mockClients } from '../data/mockClients'

// Convierte el row de Supabase al formato que usa el UI
function normalizeNutritionPlan(raw) {
  if (!raw) return null
  if (raw.lastUpdate !== undefined) return raw // ya normalizado (mock)
  return {
    calories:   raw.calories,
    protein:    raw.protein,
    carbs:      raw.carbs,
    fat:        raw.fats,          // Supabase: fats → UI: fat
    meals:      raw.meals ?? [],
    notes:      raw.notes ?? '',
    lastUpdate: raw.updated_at?.slice(0, 10) ?? '',
  }
}

/**
 * Retorna el plan nutricional activo de un cliente.
 */
export async function getNutritionPlan(clientId) {
  if (!isSupabaseConfigured) {
    const client = mockClients.find((c) => c.id === clientId)
    return {
      data: client?.nutrition ?? null,
      error: null,
      source: 'mock',
    }
  }

  const { data, error } = await supabase
    .from('nutrition_plans')
    .select('*')
    .eq('client_id', clientId)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return { data: error ? null : normalizeNutritionPlan(data), error, source: 'supabase' }
}

/**
 * Retorna el plan nutricional del asesorado autenticado.
 */
export async function getMyNutritionPlan() {
  if (!isSupabaseConfigured) {
    const client = mockClients.find((c) => c.status === 'active')
    return { data: client?.nutrition ?? null, error: null, source: 'mock' }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: new Error('No autenticado'), source: 'supabase' }

  // Primero encontramos el client_id del usuario
  const { data: clientData, error: clientError } = await supabase
    .from('clients')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (clientError || !clientData) {
    return { data: null, error: clientError, source: 'supabase' }
  }

  const { data, error } = await supabase
    .from('nutrition_plans')
    .select('*')
    .eq('client_id', clientData.id)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return { data: error ? null : normalizeNutritionPlan(data), error, source: 'supabase' }
}

/**
 * Crea o actualiza el plan nutricional de un cliente.
 */
export async function upsertNutritionPlan(clientId, payload) {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error('Requiere Supabase configurado') }
  }

  const { data: { user } } = await supabase.auth.getUser()

  // Desactivar plan anterior
  await supabase
    .from('nutrition_plans')
    .update({ active: false })
    .eq('client_id', clientId)
    .eq('active', true)

  const { data, error } = await supabase
    .from('nutrition_plans')
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
