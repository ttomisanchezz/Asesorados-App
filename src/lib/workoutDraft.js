// ---------------------------------------------------------------------------
// Borrador local (red de seguridad) del registro de entrenamiento.
//
// Mientras el asesorado carga una sesión, vamos guardando lo que escribe en el
// almacenamiento local del navegador. Si recarga la página, se le cierra el
// navegador o sale sin tocar "finalizar", al volver puede recuperar lo cargado.
//
// - Es 100% local del dispositivo: NO toca Supabase ni las sesiones guardadas.
// - Una clave por (asesorado, plan, día): los días no se pisan entre sí.
// - Vence a los 3 días desde la última edición.
// - Si localStorage no está disponible (incógnito/deshabilitado), degrada a
//   no-op sin romper la pantalla.
// ---------------------------------------------------------------------------

export const DRAFT_TTL_MS = 3 * 24 * 60 * 60 * 1000 // 3 días
export const DRAFT_VERSION = 1

const PREFIX = 'asesorados:workout-draft'

/** Clave única del borrador de un día concreto de un asesorado. */
export function draftKeyFor({ userId, planId, dayKey }) {
  return `${PREFIX}:${userId ?? 'anon'}:${planId ?? 'noplan'}:${dayKey ?? 'noday'}`
}

/** Acceso defensivo a localStorage: devuelve null si no está disponible. */
function safeStorage() {
  try {
    const storage = globalThis.localStorage
    if (!storage) return null
    const probe = `${PREFIX}:__probe__`
    storage.setItem(probe, '1')
    storage.removeItem(probe)
    return storage
  } catch {
    return null
  }
}

/** Guarda/actualiza el borrador. No-op si no hay storage o no hay clave. */
export function saveDraft(key, { exercises, note }, now = Date.now()) {
  const storage = safeStorage()
  if (!storage || !key) return
  try {
    storage.setItem(
      key,
      JSON.stringify({
        v: DRAFT_VERSION,
        savedAt: now,
        note: note ?? '',
        exercises: exercises ?? {},
      }),
    )
  } catch {
    // Cuota llena u otro error de escritura: ignorar (es solo una red de seguridad).
  }
}

/**
 * Lee el borrador. Devuelve { note, exercises, savedAt } o null.
 * Descarta (y limpia) borradores vencidos o corruptos.
 */
export function loadDraft(key, now = Date.now()) {
  const storage = safeStorage()
  if (!storage || !key) return null

  let raw
  try {
    raw = storage.getItem(key)
  } catch {
    return null
  }
  if (!raw) return null

  let obj
  try {
    obj = JSON.parse(raw)
  } catch {
    removeDraft(key)
    return null
  }

  if (!obj || typeof obj !== 'object' || typeof obj.savedAt !== 'number') {
    removeDraft(key)
    return null
  }
  if (now - obj.savedAt > DRAFT_TTL_MS) {
    removeDraft(key) // vencido
    return null
  }

  return {
    note: typeof obj.note === 'string' ? obj.note : '',
    exercises: obj.exercises && typeof obj.exercises === 'object' ? obj.exercises : {},
    savedAt: obj.savedAt,
  }
}

/** Borra el borrador. No-op si no hay storage. */
export function removeDraft(key) {
  const storage = safeStorage()
  if (!storage || !key) return
  try {
    storage.removeItem(key)
  } catch {
    // Ignorar.
  }
}

/** ¿El borrador tiene algo que valga la pena guardar/ofrecer? (peso, reps o nota) */
export function draftHasData({ exercises, note } = {}) {
  if (typeof note === 'string' && note.trim() !== '') return true
  if (!exercises) return false
  return Object.values(exercises).some(
    (sets) =>
      Array.isArray(sets) &&
      sets.some((s) => String(s?.weight ?? '') !== '' || String(s?.reps ?? '') !== ''),
  )
}

/**
 * Serializa el `form` (array paralelo a los ejercicios del día) a un mapa
 * { [nombreEjercicio]: series[] }. Guardar por NOMBRE (no por índice) permite
 * recuperar bien aunque el coach reordene/agregue/quite ejercicios.
 */
export function formToExercises(exerciseList, form) {
  const out = {}
  ;(exerciseList ?? []).forEach((ex, i) => {
    const sets = form?.[i]
    if (Array.isArray(sets)) out[ex.name] = sets.map((s) => ({ ...s }))
  })
  return out
}

/**
 * Reconstruye el `form` a partir del borrador, alineado a los ejercicios
 * ACTUALES del día. Para cada ejercicio:
 *   - si el borrador tiene series guardadas para ese nombre → las usa,
 *   - si no (ejercicio nuevo o renombrado) → usa las series por defecto.
 * Los ejercicios del borrador que ya no existen en el plan se ignoran.
 */
export function exercisesToForm(exerciseList, exercisesMap, defaultSetsFor) {
  return (exerciseList ?? []).map((ex) => {
    const saved = exercisesMap?.[ex.name]
    if (Array.isArray(saved) && saved.length > 0) return saved.map((s) => ({ ...s }))
    return defaultSetsFor(ex)
  })
}
