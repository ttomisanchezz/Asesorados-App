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

// ===========================================================================
// FASE C — Cumplimiento del plan + registro de comidas (migración 0003).
// Tablas: nutrition_compliance (1 fila por cliente/día), nutrition_logs.
// Las escrituras corren con la sesión del navegador y las autoriza RLS:
// el asesorado solo puede tocar lo suyo (clients.user_id = auth.uid()).
// ===========================================================================

// Resuelve el client_id del asesorado autenticado (mismo patrón que
// workoutLogService.resolveClient y getMyNutritionPlan).
async function resolveClient() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { client: null, error: new Error('No autenticado') }
  const { data: client, error } = await supabase
    .from('clients')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (error || !client) {
    return { client: null, error: error || new Error('Perfil no encontrado'), reason: 'no-client' }
  }
  return { client, error: null }
}

// Fecha local en formato YYYY-MM-DD (evita el corrimiento de zona de toISOString).
function todayLocalDate() {
  const d = new Date()
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10)
}

/**
 * El asesorado marca su cumplimiento del día. Upsert por (client_id, log_date):
 * volver a marcar el mismo día actualiza el estado en vez de duplicar.
 * @param {{ status: 'cumplido'|'parcial'|'no_cumplido', note?: string, date?: string }} payload
 */
export async function upsertCompliance({ status, note, date }) {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error('Requiere Supabase configurado') }
  }

  const { client, error, reason } = await resolveClient()
  if (!client) return { data: null, error: error || new Error('Perfil no encontrado'), reason }

  const { data, error: qErr } = await supabase
    .from('nutrition_compliance')
    .upsert(
      {
        client_id: client.id,
        log_date: date || todayLocalDate(),
        status,
        note: note?.trim() || null,
      },
      { onConflict: 'client_id,log_date' },
    )
    .select()
    .single()

  return { data, error: qErr }
}

/**
 * Historial de cumplimiento del asesorado autenticado (más reciente primero).
 */
export async function getMyCompliance(limit = 14) {
  if (!isSupabaseConfigured) return { data: [], error: null, source: 'mock' }

  const { client, error } = await resolveClient()
  if (!client) return { data: [], error, source: 'supabase' }

  return getCompliance(client.id, limit)
}

/**
 * Historial de cumplimiento de un cliente (para la vista del coach).
 */
export async function getCompliance(clientId, limit = 14) {
  if (!isSupabaseConfigured) return { data: [], error: null, source: 'mock' }

  const { data, error } = await supabase
    .from('nutrition_compliance')
    .select('*')
    .eq('client_id', clientId)
    .order('log_date', { ascending: false })
    .limit(limit)

  return { data: error ? [] : (data ?? []), error, source: 'supabase' }
}

/**
 * El asesorado registra una comida (texto libre). Devuelve la fila creada.
 * @param {{ description: string, mealLabel?: string, calories?: number|null, protein?: number|null }} payload
 */
export async function addFoodLog({ description, mealLabel, calories, protein }) {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error('Requiere Supabase configurado') }
  }

  const { client, error, reason } = await resolveClient()
  if (!client) return { data: null, error: error || new Error('Perfil no encontrado'), reason }

  const { data, error: qErr } = await supabase
    .from('nutrition_logs')
    .insert({
      client_id: client.id,
      description: description.trim(),
      meal_label: mealLabel?.trim() || null,
      calories: calories ?? null,
      protein: protein ?? null,
    })
    .select()
    .single()

  return { data, error: qErr }
}

/**
 * Comidas registradas por el asesorado autenticado (más recientes primero).
 */
export async function getMyFoodLogs(limit = 20) {
  if (!isSupabaseConfigured) return { data: [], error: null, source: 'mock' }

  const { client, error } = await resolveClient()
  if (!client) return { data: [], error, source: 'supabase' }

  return getFoodLogs(client.id, limit)
}

/**
 * Comidas registradas por un cliente (para la vista del coach).
 */
export async function getFoodLogs(clientId, limit = 20) {
  if (!isSupabaseConfigured) return { data: [], error: null, source: 'mock' }

  const { data, error } = await supabase
    .from('nutrition_logs')
    .select('*')
    .eq('client_id', clientId)
    .order('logged_at', { ascending: false })
    .limit(limit)

  return { data: error ? [] : (data ?? []), error, source: 'supabase' }
}
