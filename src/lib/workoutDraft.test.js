import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  DRAFT_TTL_MS,
  draftKeyFor,
  saveDraft,
  loadDraft,
  removeDraft,
  draftHasData,
  formToExercises,
  exercisesToForm,
} from './workoutDraft'

// localStorage en memoria: el entorno de tests es node (sin DOM).
function makeMemoryStorage() {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  }
}

beforeEach(() => {
  globalThis.localStorage = makeMemoryStorage()
})
afterEach(() => {
  delete globalThis.localStorage
})

describe('draftKeyFor', () => {
  it('arma una clave única por asesorado/plan/día', () => {
    expect(draftKeyFor({ userId: 'u1', planId: 'p1', dayKey: 'A' })).toBe(
      'asesorados:workout-draft:u1:p1:A',
    )
  })
  it('días distintos del mismo plan no comparten clave', () => {
    const a = draftKeyFor({ userId: 'u1', planId: 'p1', dayKey: 'A' })
    const b = draftKeyFor({ userId: 'u1', planId: 'p1', dayKey: 'B' })
    expect(a).not.toBe(b)
  })
  it('tolera valores faltantes con marcadores', () => {
    expect(draftKeyFor({})).toBe('asesorados:workout-draft:anon:noplan:noday')
  })
})

describe('saveDraft / loadDraft', () => {
  const key = draftKeyFor({ userId: 'u1', planId: 'p1', dayKey: 'A' })

  it('guarda y recupera el mismo contenido', () => {
    const payload = { note: 'piernas pesadas', exercises: { Sentadilla: [{ weight: '100', reps: '8' }] } }
    saveDraft(key, payload)
    const got = loadDraft(key)
    expect(got.note).toBe('piernas pesadas')
    expect(got.exercises.Sentadilla).toEqual([{ weight: '100', reps: '8' }])
    expect(typeof got.savedAt).toBe('number')
  })

  it('devuelve null si no hay borrador', () => {
    expect(loadDraft(key)).toBeNull()
  })

  it('descarta y limpia borradores vencidos (> 3 días)', () => {
    const old = Date.now() - DRAFT_TTL_MS - 1000
    saveDraft(key, { note: 'viejo', exercises: {} }, old)
    expect(loadDraft(key)).toBeNull()
    // Quedó limpiado del storage.
    expect(globalThis.localStorage.getItem(key)).toBeNull()
  })

  it('mantiene borradores dentro de la ventana de 3 días', () => {
    const recent = Date.now() - (DRAFT_TTL_MS - 60_000)
    saveDraft(key, { note: 'reciente', exercises: {} }, recent)
    expect(loadDraft(key)?.note).toBe('reciente')
  })

  it('descarta y limpia borradores corruptos', () => {
    globalThis.localStorage.setItem(key, '{no es json')
    expect(loadDraft(key)).toBeNull()
    expect(globalThis.localStorage.getItem(key)).toBeNull()
  })
})

describe('removeDraft', () => {
  it('elimina el borrador', () => {
    const key = draftKeyFor({ userId: 'u1', planId: 'p1', dayKey: 'A' })
    saveDraft(key, { note: 'x', exercises: {} })
    removeDraft(key)
    expect(loadDraft(key)).toBeNull()
  })
})

describe('storage no disponible', () => {
  it('no rompe: save/load/remove son no-op', () => {
    delete globalThis.localStorage
    const key = draftKeyFor({ userId: 'u1', planId: 'p1', dayKey: 'A' })
    expect(() => saveDraft(key, { note: 'x', exercises: {} })).not.toThrow()
    expect(loadDraft(key)).toBeNull()
    expect(() => removeDraft(key)).not.toThrow()
  })
})

describe('draftHasData', () => {
  it('false cuando todo está vacío', () => {
    expect(draftHasData({ note: '', exercises: { Press: [{ weight: '', reps: '' }] } })).toBe(false)
    expect(draftHasData({ note: '   ', exercises: {} })).toBe(false)
    expect(draftHasData()).toBe(false)
  })
  it('true si hay nota', () => {
    expect(draftHasData({ note: 'me dolió el hombro', exercises: {} })).toBe(true)
  })
  it('true si alguna serie tiene peso o reps', () => {
    expect(draftHasData({ note: '', exercises: { Press: [{ weight: '40', reps: '' }] } })).toBe(true)
    expect(draftHasData({ note: '', exercises: { Press: [{ weight: '', reps: '10' }] } })).toBe(true)
  })
})

describe('formToExercises / exercisesToForm', () => {
  const exercises = [{ name: 'Sentadilla', sets: '3' }, { name: 'Prensa', sets: '2' }]
  const defaultSetsFor = (ex) =>
    Array.from({ length: Math.max(...String(ex.sets).match(/\d+/g).map(Number)) }, () => ({ weight: '', reps: '' }))

  it('serializa el form a un mapa por nombre de ejercicio', () => {
    const form = [
      [{ weight: '100', reps: '8' }, { weight: '100', reps: '7' }],
      [{ weight: '200', reps: '10' }],
    ]
    const map = formToExercises(exercises, form)
    expect(map.Sentadilla).toHaveLength(2)
    expect(map.Prensa).toEqual([{ weight: '200', reps: '10' }])
  })

  it('reconstruye el form alineado a los ejercicios actuales', () => {
    const map = { Sentadilla: [{ weight: '100', reps: '8' }] }
    const form = exercisesToForm(exercises, map, defaultSetsFor)
    expect(form[0]).toEqual([{ weight: '100', reps: '8' }]) // recuperado
    expect(form[1]).toEqual([{ weight: '', reps: '' }, { weight: '', reps: '' }]) // default (no estaba)
  })

  it('ignora ejercicios del borrador que ya no existen en el plan', () => {
    const map = { 'Ejercicio viejo': [{ weight: '50', reps: '5' }], Sentadilla: [{ weight: '90', reps: '9' }] }
    const form = exercisesToForm(exercises, map, defaultSetsFor)
    expect(form).toHaveLength(2)
    expect(form[0]).toEqual([{ weight: '90', reps: '9' }])
  })
})
