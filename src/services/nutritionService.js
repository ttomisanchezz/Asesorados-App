import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { mockClients } from '../data/mockClients'
import { demoNutritionHistory } from '../data/demoRuntime'

function demoHistory(clientId) {
  if (!demoNutritionHistory.has(clientId)) {
    const source = mockClients.find((client) => client.id === clientId)?.nutrition
    demoNutritionHistory.set(clientId, source ? [{
      ...source, id: `demo-nutrition-${clientId}`, active: true,
      createdAt: source.lastUpdate ? `${source.lastUpdate}T00:00:00` : new Date().toISOString(),
    }] : [])
  }
  return demoNutritionHistory.get(clientId)
}

// Convierte el row de Supabase al formato que usa el UI
export function normalizeNutritionPlan(raw) {
  if (!raw) return null
  if (raw.lastUpdate !== undefined) return raw // ya normalizado (mock)
  return {
    id:         raw.id ?? null,
    clientId:   raw.client_id ?? null,
    title:      raw.title ?? '',
    calories:   raw.calories,
    protein:    raw.protein,
    carbs:      raw.carbs,
    fat:        raw.fats,          // Supabase: fats → UI: fat
    meals:      raw.meals ?? [],
    notes:      raw.notes ?? '',
    active:     raw.active ?? false,
    createdAt:  raw.created_at ?? null,
    updatedAt:  raw.updated_at ?? null,
    lastUpdate: raw.updated_at?.slice(0, 10) ?? '',
  }
}

function nutritionPayload(payload) {
  return {
    title: payload.title?.trim() || null,
    calories: payload.calories === '' ? null : payload.calories ?? null,
    protein: payload.protein === '' ? null : payload.protein ?? null,
    carbs: payload.carbs === '' ? null : payload.carbs ?? null,
    fats: payload.fats === '' ? null : payload.fats ?? payload.fat ?? null,
    meals: payload.meals ?? [],
    notes: payload.notes?.trim() || null,
  }
}

async function getAllClientRows(table, clientId, orderColumn) {
  const rows = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from(table).select('*').eq('client_id', clientId)
      .order(orderColumn, { ascending: false }).range(from, from + pageSize - 1)
    if (error) return { data: rows, error }
    rows.push(...(data ?? []))
    if ((data?.length ?? 0) < pageSize) return { data: rows, error: null }
  }
}

/**
 * Retorna el plan nutricional activo de un cliente.
 */
export async function getNutritionPlan(clientId) {
  if (!isSupabaseConfigured) {
    return {
      data: demoHistory(clientId).find((plan) => plan.active) ?? null,
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

  // Primero encontramos el client_id del usuario (y su objetivo, que vive en clients).
  const { data: clientData, error: clientError } = await supabase
    .from('clients')
    .select('id, objective')
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

  // El objetivo se guarda en clients, no en nutrition_plans: lo adjuntamos al plan.
  const plan = error ? null : { ...normalizeNutritionPlan(data), objective: clientData.objective ?? null }
  return { data: plan, error, source: 'supabase' }
}

/**
 * Crea o actualiza el plan nutricional de un cliente.
 */
export async function createNutritionPlanVersion(clientId, payload) {
  if (!isSupabaseConfigured) {
    const history = demoHistory(clientId)
    history.forEach((plan) => { plan.active = false })
    const created = { ...payload, id: `demo-nutrition-${Date.now()}`, active: true, createdAt: new Date().toISOString(), lastUpdate: new Date().toISOString().slice(0, 10) }
    history.unshift(created)
    return { data: created, error: null, source: 'mock' }
  }

  const clean = nutritionPayload(payload)
  const { data, error } = await supabase.rpc('create_nutrition_plan_version', {
    p_client_id: clientId,
    p_title: clean.title,
    p_calories: clean.calories,
    p_protein: clean.protein,
    p_carbs: clean.carbs,
    p_fats: clean.fats,
    p_meals: clean.meals,
    p_notes: clean.notes,
  })

  return { data: error ? null : normalizeNutritionPlan(data), error }
}

/** Historial completo, con la versión activa primero y luego por fecha. */
export async function getNutritionPlanHistory(clientId) {
  if (!isSupabaseConfigured) {
    return { data: [...demoHistory(clientId)], error: null, source: 'mock' }
  }

  const { data, error } = await supabase
    .from('nutrition_plans')
    .select('*')
    .eq('client_id', clientId)
    .order('active', { ascending: false })
    .order('created_at', { ascending: false })

  return { data: error ? [] : (data ?? []).map(normalizeNutritionPlan), error, source: 'supabase' }
}

/** Edita una versión existente sin activarla ni alterar el resto del historial. */
export async function updateNutritionPlanVersion(planId, payload) {
  if (!isSupabaseConfigured) {
    for (const history of demoNutritionHistory.values()) {
      const index = history.findIndex((plan) => plan.id === planId)
      if (index >= 0) {
        history[index] = { ...history[index], ...payload, updatedAt: new Date().toISOString(), lastUpdate: new Date().toISOString().slice(0, 10) }
        return { data: history[index], error: null, source: 'mock' }
      }
    }
    return { data: null, error: new Error('Plan no encontrado'), source: 'mock' }
  }

  const { data, error } = await supabase
    .from('nutrition_plans')
    .update(nutritionPayload(payload))
    .eq('id', planId)
    .select()
    .single()

  return { data: error ? null : normalizeNutritionPlan(data), error }
}

/** Alias conservado para consumidores existentes. */
export async function upsertNutritionPlan(clientId, payload) {
  return createNutritionPlanVersion(clientId, payload)
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

// ===========================================================================
// FASE E — Marcado de comidas consumidas (migración 0005).
// El asesorado marca, por cada comida del plan, qué OPCIÓN comió. De esas marcas
// se deriva el cumplimiento del día (comidas marcadas / comidas del plan) y se
// sincroniza a nutrition_compliance, que es lo que ya alimenta la adherencia del
// coach. "Se actualiza en toda la app" porque todo cuelga de la misma fuente.
// ===========================================================================

/**
 * Recalcula el cumplimiento del día a partir de las comidas marcadas y lo
 * sincroniza a nutrition_compliance. Sin comidas marcadas borra la fila del día
 * (no inventa 0%: ese día simplemente no tiene dato). Con marcas calcula el
 * ratio comidas marcadas / comidas del plan de ese día.
 *
 * countKeys (opcional): meal_keys que cuentan para el % de HOY. En planes
 * semanales solo cuentan las comidas del día actual, aunque el asesorado pueda
 * marcar comidas de otros días (esas quedan registradas pero no inflan el %).
 */
async function syncDayCompliance(clientId, logDate, mealsTotal, countKeys) {
  const total = Number(mealsTotal) || 0

  let done
  if (Array.isArray(countKeys)) {
    // Contamos solo las marcas cuyo meal_key cuenta para hoy.
    const { data, error } = await supabase
      .from('nutrition_meal_checks')
      .select('meal_key')
      .eq('client_id', clientId)
      .eq('log_date', logDate)
    if (error) return { error }
    const keep = new Set(countKeys)
    done = (data ?? []).filter((r) => keep.has(r.meal_key)).length
  } else {
    const { count, error } = await supabase
      .from('nutrition_meal_checks')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('log_date', logDate)
    if (error) return { error }
    done = count ?? 0
  }

  done = total > 0 ? Math.min(done, total) : done

  if (!done) {
    await supabase
      .from('nutrition_compliance')
      .delete()
      .eq('client_id', clientId)
      .eq('log_date', logDate)
    return { error: null, compliance: { done: 0, total } }
  }

  const status = total > 0 && done >= total ? 'cumplido' : 'parcial'
  const { error: cErr } = await supabase
    .from('nutrition_compliance')
    .upsert(
      {
        client_id: clientId,
        log_date: logDate,
        status,
        meals_done: done,
        meals_total: total || null,
      },
      { onConflict: 'client_id,log_date' },
    )
  return { error: cErr || null, compliance: { done, total, status } }
}

/**
 * Marca (o desmarca) la opción que el asesorado comió en una comida del plan.
 * optionIndex null/undefined → desmarca la comida. Una sola opción por comida
 * (son alternativas): el upsert por (client_id, log_date, meal_key) reemplaza.
 * Tras escribir, recalcula el cumplimiento del día.
 *
 * @param {{
 *   mealKey: string, schemeLabel?: string, mealName?: string,
 *   optionIndex?: number|null, optionTitle?: string,
 *   mealsTotal: number, date?: string
 * }} payload
 */
export async function setMealCheck({
  mealKey, schemeLabel, mealName, optionIndex, optionTitle, mealsTotal, date, countKeys,
}) {
  if (!isSupabaseConfigured) {
    return { error: new Error('Requiere Supabase configurado') }
  }

  const { client, error, reason } = await resolveClient()
  if (!client) return { error: error || new Error('Perfil no encontrado'), reason }

  const logDate = date || todayLocalDate()

  if (optionIndex == null) {
    const { error: dErr } = await supabase
      .from('nutrition_meal_checks')
      .delete()
      .eq('client_id', client.id)
      .eq('log_date', logDate)
      .eq('meal_key', mealKey)
    if (dErr) return { error: dErr }
  } else {
    const { error: uErr } = await supabase
      .from('nutrition_meal_checks')
      .upsert(
        {
          client_id: client.id,
          log_date: logDate,
          meal_key: mealKey,
          scheme_label: schemeLabel || null,
          meal_name: mealName || null,
          option_index: optionIndex,
          option_title: optionTitle || null,
        },
        { onConflict: 'client_id,log_date,meal_key' },
      )
    if (uErr) return { error: uErr }
  }

  return syncDayCompliance(client.id, logDate, mealsTotal, countKeys)
}

/**
 * Comidas marcadas por el asesorado autenticado en una fecha (hoy por defecto).
 * Devuelve las filas crudas de nutrition_meal_checks.
 */
export async function getMyMealChecks(date) {
  if (!isSupabaseConfigured) return { data: [], error: null, source: 'mock' }

  const { client, error } = await resolveClient()
  if (!client) return { data: [], error, source: 'supabase' }

  const { data, error: qErr } = await supabase
    .from('nutrition_meal_checks')
    .select('*')
    .eq('client_id', client.id)
    .eq('log_date', date || todayLocalDate())
    .limit(100)

  return { data: qErr ? [] : (data ?? []), error: qErr, source: 'supabase' }
}

/**
 * Comidas marcadas por un cliente en una fecha (para la vista del coach).
 */
export async function getMealChecks(clientId, date) {
  if (!isSupabaseConfigured) return { data: [], error: null, source: 'mock' }

  const { data, error } = await supabase
    .from('nutrition_meal_checks')
    .select('*')
    .eq('client_id', clientId)
    .eq('log_date', date || todayLocalDate())
    .limit(100)

  return { data: error ? [] : (data ?? []), error, source: 'supabase' }
}

/**
 * Dataset completo para la agenda semanal del coach. No aplica una ventana
 * artificial de días: las semanas disponibles se derivan de estos registros.
 */
export async function getClientNutritionActivity(clientId) {
  if (!isSupabaseConfigured) {
    const history = await getNutritionPlanHistory(clientId)
    return {
      data: { plans: history.data, compliance: [], logs: [], mealChecks: [] },
      error: null,
      source: 'mock',
    }
  }

  const [plansResult, complianceResult, logsResult, checksResult] = await Promise.all([
    getNutritionPlanHistory(clientId),
    getAllClientRows('nutrition_compliance', clientId, 'log_date'),
    getAllClientRows('nutrition_logs', clientId, 'logged_at'),
    getAllClientRows('nutrition_meal_checks', clientId, 'log_date'),
  ])

  const error = plansResult.error || complianceResult.error || logsResult.error || checksResult.error
  return {
    data: {
      plans: plansResult.data ?? [],
      compliance: complianceResult.data ?? [],
      logs: logsResult.data ?? [],
      mealChecks: checksResult.data ?? [],
    },
    error,
    source: 'supabase',
  }
}
