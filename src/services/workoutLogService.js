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
 * Devuelve un mapa { [exercise_name]: { weight, reps, date, sets } } donde:
 *   - sets:  { [setNumber]: { weight, reps } } con CADA serie de la última sesión
 *            en la que se registró ese ejercicio (la "referencia anterior" por serie).
 *   - weight/reps/date: representativos (serie 1 de esa sesión) — los conserva la
 *            vista de lectura que muestra "Última vez: 80 kg × 8 reps".
 *
 * Antes solo se devolvía un único peso/reps por ejercicio y la UI lo repetía en
 * todas las series; ahora cada serie muestra lo que realmente cargó esa serie.
 */
export async function getMyLastLogsByExercise() {
  if (!isSupabaseConfigured) return { data: {}, error: null }

  const { client, error } = await resolveClient()
  if (!client) return { data: {}, error }

  const { data, error: qErr } = await supabase
    .from('workout_exercise_logs')
    .select('exercise_name, session_id, set_number, weight, actual_reps, created_at')
    .eq('client_id', client.id)
    .order('created_at', { ascending: false })
    .limit(1000)

  if (qErr) return { data: {}, error: qErr }

  const map = {}
  for (const row of data ?? []) {
    const hasData = row.weight != null || row.actual_reps != null
    if (!hasData) continue

    // La primera fila que aparece para el ejercicio (orden descendente) fija la
    // sesión más reciente; anclamos a su session_id para no mezclar sesiones.
    if (!map[row.exercise_name]) {
      map[row.exercise_name] = {
        sessionId: row.session_id,
        date: row.created_at,
        weight: null,
        reps: null,
        sets: {},
      }
    }
    const ref = map[row.exercise_name]
    if (row.session_id !== ref.sessionId) continue // solo la última sesión

    if (row.set_number != null && !(row.set_number in ref.sets)) {
      ref.sets[row.set_number] = { weight: row.weight, reps: row.actual_reps }
    }
  }

  // Representativo para la vista de lectura: la serie más baja registrada.
  for (const ref of Object.values(map)) {
    const nums = Object.keys(ref.sets).map(Number).sort((a, b) => a - b)
    const first = nums.length ? ref.sets[nums[0]] : null
    ref.weight = first?.weight ?? null
    ref.reps = first?.reps ?? null
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
