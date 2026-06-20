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
 * Historial de entrenamientos del asesorado autenticado, agregado para mostrar
 * progresión a lo largo de las semanas: cómo fueron subiendo carga y series por
 * ejercicio. Trae todas las sesiones + sus series y las resume.
 *
 * Por cada (ejercicio, sesión) calcula:
 *   - sets:      cantidad de series registradas
 *   - topWeight: peso más alto cargado en esa sesión
 *   - maxReps:   reps máximas en una serie
 *   - volume:    Σ (peso × reps) de todas las series (tonelaje)
 *   - est1rm:    mejor 1RM estimado (Epley: peso × (1 + reps/30))
 *
 * @returns {{ data: {
 *   totalSessions: number,
 *   firstDate: string|null, lastDate: string|null,
 *   sessions: Array<{ id, date, dayKey, dayName, notes, exerciseCount, totalSets, totalVolume }>,
 *   exercises: Array<{
 *     name: string, sessionsCount: number,
 *     points: Array<{ date, sessionId, sets, topWeight, maxReps, volume, est1rm }>,
 *     first: object, last: object,
 *     weightDelta: number|null, setsDelta: number|null, volumeDelta: number|null,
 *   }>,
 * }|null, error: Error|null }}
 */
export async function getMyWorkoutHistory() {
  if (!isSupabaseConfigured) return { data: null, error: null }

  const { client, error } = await resolveClient()
  if (!client) return { data: null, error }

  // 1) Sesiones del asesorado, ascendentes por fecha de realización.
  const { data: sessions, error: sErr } = await supabase
    .from('workout_sessions')
    .select('id, day_key, day_name, performed_at, notes, created_at')
    .eq('client_id', client.id)
    .order('performed_at', { ascending: true })
    .limit(500)

  if (sErr) return { data: null, error: sErr }

  const empty = { totalSessions: 0, firstDate: null, lastDate: null, sessions: [], exercises: [] }
  if (!sessions?.length) return { data: empty, error: null }

  // 2) Series de todas esas sesiones.
  const sessionIds = sessions.map((s) => s.id)
  const { data: logs, error: lErr } = await supabase
    .from('workout_exercise_logs')
    .select('session_id, exercise_name, exercise_order, set_number, actual_reps, weight')
    .in('session_id', sessionIds)
    .limit(8000)

  if (lErr) return { data: null, error: lErr }

  // 3) Agrupar series por sesión y por ejercicio dentro de cada sesión.
  const round = (n) => Math.round(n * 100) / 100
  const dateOf = (s) => s.performed_at || s.created_at
  const sessionById = new Map(sessions.map((s) => [s.id, s]))

  // logsBySession: { sessionId: { exerciseName: { sets, topWeight, maxReps, volume, est1rm } } }
  const agg = new Map() // sessionId -> Map(exerciseName -> metrics)
  for (const row of logs ?? []) {
    if (!agg.has(row.session_id)) agg.set(row.session_id, new Map())
    const byEx = agg.get(row.session_id)
    if (!byEx.has(row.exercise_name)) {
      byEx.set(row.exercise_name, { sets: 0, topWeight: null, maxReps: null, volume: 0, est1rm: null })
    }
    const m = byEx.get(row.exercise_name)
    m.sets += 1
    const w = row.weight != null ? Number(row.weight) : null
    const r = row.actual_reps != null ? Number(row.actual_reps) : null
    if (w != null) m.topWeight = m.topWeight == null ? w : Math.max(m.topWeight, w)
    if (r != null) m.maxReps = m.maxReps == null ? r : Math.max(m.maxReps, r)
    if (w != null && r != null) {
      m.volume += w * r
      const e = w * (1 + r / 30)
      m.est1rm = m.est1rm == null ? e : Math.max(m.est1rm, e)
    }
  }

  // 4) Resumen por sesión (para el encabezado / actividad).
  const sessionSummaries = sessions.map((s) => {
    const byEx = agg.get(s.id)
    let totalSets = 0
    let totalVolume = 0
    if (byEx) {
      for (const m of byEx.values()) {
        totalSets += m.sets
        totalVolume += m.volume
      }
    }
    return {
      id: s.id,
      date: dateOf(s),
      dayKey: s.day_key,
      dayName: s.day_name,
      notes: s.notes,
      exerciseCount: byEx ? byEx.size : 0,
      totalSets,
      totalVolume: round(totalVolume),
    }
  })

  // 5) Serie de puntos por ejercicio, ascendente por fecha.
  const exMap = new Map() // exerciseName -> points[]
  for (const s of sessions) {
    const byEx = agg.get(s.id)
    if (!byEx) continue
    for (const [name, m] of byEx.entries()) {
      if (!exMap.has(name)) exMap.set(name, [])
      exMap.get(name).push({
        date: dateOf(s),
        sessionId: s.id,
        sets: m.sets,
        topWeight: m.topWeight,
        maxReps: m.maxReps,
        volume: round(m.volume),
        est1rm: m.est1rm != null ? round(m.est1rm) : null,
      })
    }
  }

  const delta = (a, b) => (a == null || b == null ? null : round(b - a))
  const exercises = [...exMap.entries()].map(([name, points]) => {
    const first = points[0]
    const last = points[points.length - 1]
    return {
      name,
      sessionsCount: points.length,
      points,
      first,
      last,
      weightDelta: delta(first.topWeight, last.topWeight),
      setsDelta: delta(first.sets, last.sets),
      volumeDelta: delta(first.volume, last.volume),
    }
  })

  // Ordenar: primero los que más se entrenaron, luego por última fecha reciente.
  exercises.sort((a, b) =>
    b.sessionsCount - a.sessionsCount || new Date(b.last.date) - new Date(a.last.date),
  )

  return {
    data: {
      totalSessions: sessions.length,
      firstDate: dateOf(sessions[0]),
      lastDate: dateOf(sessions[sessions.length - 1]),
      sessions: sessionSummaries,
      exercises,
    },
    error: null,
  }
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
