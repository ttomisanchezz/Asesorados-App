import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'

// ---------------------------------------------------------------------------
// Registro de entrenamientos del asesorado: sesiones + series por ejercicio.
// Tablas: workout_sessions, workout_exercise_logs (ver migración 0002).
// Toda escritura corre con la sesión del navegador (anon key) y la autoriza RLS:
// el asesorado solo puede tocar lo suyo (clients.user_id = auth.uid()).
// ---------------------------------------------------------------------------

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

/**
 * Convierte el campo `sets` del plan (string como "3", "3-4", o null) en una
 * cantidad de series. Para un rango toma el valor mayor. Mínimo 1 si no hay dato
 * (así siempre se puede registrar al menos una serie).
 */
export function parseSetsCount(sets, fallback = 1) {
  if (sets == null) return fallback
  const nums = String(sets).match(/\d+/g)
  if (!nums) return fallback
  return Math.max(...nums.map(Number)) || fallback
}

/**
 * Último registro por ejercicio del asesorado autenticado.
 * Devuelve un mapa { [exercise_name]: { weight, reps, date } } con el log más
 * reciente de cada ejercicio — la "referencia anterior" para superar.
 */
export async function getMyLastLogsByExercise() {
  if (!isSupabaseConfigured) return { data: {}, error: null }

  const { client, error } = await resolveClient()
  if (!client) return { data: {}, error }

  const { data, error: qErr } = await supabase
    .from('workout_exercise_logs')
    .select('exercise_name, weight, actual_reps, created_at')
    .eq('client_id', client.id)
    .order('created_at', { ascending: false })
    .limit(500)

  if (qErr) return { data: {}, error: qErr }

  const map = {}
  for (const row of data ?? []) {
    // El primero que aparece (orden descendente) es el más reciente de ese ejercicio.
    if (!map[row.exercise_name] && (row.weight != null || row.actual_reps != null)) {
      map[row.exercise_name] = {
        weight: row.weight,
        reps: row.actual_reps,
        date: row.created_at,
      }
    }
  }
  return { data: map, error: null }
}

/**
 * Cantidad de entrenamientos (workout_sessions) del asesorado autenticado
 * desde una fecha dada (por defecto: inicio de la semana actual, lunes).
 * Solo cuenta — no trae filas. Sirve para la adherencia de entrenamiento.
 *
 * @param {string} [sinceIso] ISO de inicio del rango (ej. lunes 00:00 local).
 * @returns {{ count: number, error: Error|null }}
 */
export async function getMyWeeklyTrainingCount(sinceIso) {
  if (!isSupabaseConfigured) return { count: 0, error: null }

  const { client, error } = await resolveClient()
  if (!client) return { count: 0, error }

  const since = sinceIso || (() => {
    const x = new Date()
    x.setHours(0, 0, 0, 0)
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7)) // retrocede al lunes
    return x.toISOString()
  })()

  const { count, error: qErr } = await supabase
    .from('workout_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', client.id)
    .gte('performed_at', since)

  if (qErr) return { count: 0, error: qErr }
  return { count: count ?? 0, error: null }
}

/**
 * Guarda un entrenamiento completo (una sesión + sus series).
 *
 * @param {{
 *   workoutPlanId?: string,
 *   dayKey?: string,
 *   dayName?: string,
 *   notes?: string,
 *   exercises: Array<{
 *     name: string, order?: number, targetReps?: string,
 *     sets: Array<{ setNumber: number, weight?: number|null, reps?: number|null, rir?: number|null }>
 *   }>
 * }} payload
 * @returns {{ error: Error|null, sessionId?: string, count?: number, reason?: string }}
 */
export async function saveWorkoutSession({ workoutPlanId, dayKey, dayName, notes, exercises }) {
  if (!isSupabaseConfigured) {
    return { error: new Error('Requiere Supabase configurado') }
  }

  const { client, error, reason } = await resolveClient()
  if (!client) return { error: error || new Error('Perfil no encontrado'), reason }

  // 1) Crear la sesión.
  const { data: session, error: sErr } = await supabase
    .from('workout_sessions')
    .insert({
      client_id: client.id,
      workout_plan_id: workoutPlanId || null,
      day_key: dayKey || null,
      day_name: dayName || null,
      notes: notes || null,
    })
    .select('id')
    .single()

  if (sErr || !session) {
    return { error: sErr || new Error('No se pudo crear la sesión') }
  }

  // 2) Armar las filas de series: solo las que tienen algún dato (peso o reps).
  const rows = []
  for (const ex of exercises ?? []) {
    for (const s of ex.sets ?? []) {
      const hasData = s.weight != null || s.reps != null
      if (!hasData) continue
      rows.push({
        session_id: session.id,
        client_id: client.id,
        exercise_name: ex.name,
        exercise_order: ex.order ?? null,
        set_number: s.setNumber,
        target_reps: ex.targetReps || null,
        actual_reps: s.reps ?? null,
        weight: s.weight ?? null,
        rir: s.rir ?? null,
      })
    }
  }

  // Sin series cargadas: borrar la sesión vacía para no ensuciar la tabla.
  if (rows.length === 0) {
    await supabase.from('workout_sessions').delete().eq('id', session.id)
    return { error: new Error('No cargaste ninguna serie con peso o repeticiones.') }
  }

  const { error: lErr } = await supabase.from('workout_exercise_logs').insert(rows)
  if (lErr) {
    // Rollback manual de la sesión si fallan las series.
    await supabase.from('workout_sessions').delete().eq('id', session.id)
    return { error: lErr }
  }

  return { error: null, sessionId: session.id, count: rows.length }
}
