import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'

// ---------------------------------------------------------------------------
// Adherencia semanal calculada desde los registros REALES del asesorado.
//
// Las columnas clients.adherence_nutrition / adherence_training son estáticas
// (nadie las recalcula), por eso el panel del coach mostraba 0% aunque el
// asesorado registrara entrenamientos. Este service calcula la semana actual
// (desde el lunes 00:00 local) con el mismo criterio que usa el panel del
// asesorado (MiPanel):
//   - Entrenamiento: workout_sessions de la semana vs. días del plan activo.
//   - Nutrición: nutrition_compliance de la semana (cumplido=100, parcial=50,
//     no_cumplido=0, promediado sobre los días registrados). Fallback: el
//     check-in de la semana con adherencia autoreportada.
// Las lecturas corren con la sesión del navegador y las autoriza RLS: el coach
// solo ve a sus clientes; el asesorado, lo suyo.
// ---------------------------------------------------------------------------

/** Lunes 00:00 hora local de la semana de `d`. */
export function startOfWeekLocal(d = new Date()) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)) // retrocede al lunes
  return x
}

// YYYY-MM-DD en hora local (sin corrimiento de zona de toISOString).
function localDateStr(d) {
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10)
}

/**
 * % de adherencia de entrenamiento: sesiones hechas vs. días planificados.
 * Sin días de plan no hay denominador honesto → null (el caller decide).
 */
export function trainingAdherencePct(sessionsDone, plannedDays) {
  if (!plannedDays || plannedDays <= 0) return null
  return Math.min(100, Math.round((sessionsDone / plannedDays) * 100))
}

/**
 * % de adherencia nutricional sobre los días registrados:
 * cumplido = 1, parcial = 0.5, no_cumplido = 0. Sin registros → null.
 */
export function nutritionAdherencePct(complianceRows) {
  const rows = complianceRows ?? []
  if (rows.length === 0) return null
  const score = rows.reduce((sum, r) => {
    if (r.status === 'cumplido') return sum + 1
    if (r.status === 'parcial') return sum + 0.5
    return sum
  }, 0)
  return Math.round((score / rows.length) * 100)
}

/**
 * Adherencia semanal de un conjunto de clientes en 4 queries batcheadas.
 * Devuelve un mapa { [clientId]: { nutrition, training, trainingDone, trainingPlanned } }
 * donde nutrition/training son % (0-100) o null si no hay datos para calcular.
 */
export async function getWeeklyAdherenceMap(clientIds) {
  if (!isSupabaseConfigured) return {}
  const ids = (clientIds ?? []).filter(Boolean)
  if (ids.length === 0) return {}

  const weekStart = startOfWeekLocal()
  const weekStartIso = weekStart.toISOString()
  const weekStartDate = localDateStr(weekStart)

  // allSettled + fallback a []: si una query falla (RLS, red), el resto de la
  // adherencia igual se calcula y el caller conserva sus valores actuales.
  const [sessions, plans, compliance, checkins] = await Promise.allSettled([
    supabase.from('workout_sessions')
      .select('client_id')
      .in('client_id', ids)
      .gte('performed_at', weekStartIso),
    supabase.from('workout_plans')
      .select('client_id, days')
      .in('client_id', ids)
      .eq('active', true),
    supabase.from('nutrition_compliance')
      .select('client_id, status')
      .in('client_id', ids)
      .gte('log_date', weekStartDate),
    supabase.from('checkins')
      .select('client_id, nutrition_adherence, training_adherence')
      .in('client_id', ids)
      .gte('created_at', weekStartIso)
      .order('created_at', { ascending: false }),
  ])

  const rowsOf = (settled) =>
    settled.status === 'fulfilled' && !settled.value?.error ? (settled.value.data ?? []) : []

  const sessionRows = rowsOf(sessions)
  const planRows = rowsOf(plans)
  const complianceRows = rowsOf(compliance)
  const checkinRows = rowsOf(checkins)

  const map = {}
  for (const id of ids) {
    const done = sessionRows.filter((r) => r.client_id === id).length
    const planDays = planRows.find((r) => r.client_id === id)?.days
    const planned = Array.isArray(planDays) ? planDays.length : 0
    const weekCompliance = complianceRows.filter((r) => r.client_id === id)
    // Check-in más reciente de la semana (vienen ordenados desc).
    const weekCheckin = checkinRows.find((r) => r.client_id === id)

    map[id] = {
      trainingDone: done,
      trainingPlanned: planned,
      training: trainingAdherencePct(done, planned) ?? weekCheckin?.training_adherence ?? null,
      nutrition: nutritionAdherencePct(weekCompliance) ?? weekCheckin?.nutrition_adherence ?? null,
    }
  }
  return map
}
