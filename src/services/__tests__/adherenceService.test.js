import { describe, it, expect, vi } from 'vitest'
import { makeSupabase } from './_supabaseMock'

const state = vi.hoisted(() => ({ sb: null }))
vi.mock('../../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: (...a) => state.sb.from(...a),
    auth: { getUser: (...a) => state.sb.auth.getUser(...a) },
  },
}))

import {
  trainingAdherencePct, nutritionAdherencePct, getWeeklyAdherenceMap,
} from '../adherenceService'

describe('trainingAdherencePct', () => {
  it('calcula sesiones vs días del plan', () => {
    expect(trainingAdherencePct(1, 5)).toBe(20)
    expect(trainingAdherencePct(3, 4)).toBe(75)
  })

  it('capea en 100 cuando entrena más de lo planificado', () => {
    expect(trainingAdherencePct(6, 5)).toBe(100)
  })

  it('sin días planificados no hay % honesto → null', () => {
    expect(trainingAdherencePct(2, 0)).toBeNull()
    expect(trainingAdherencePct(2, null)).toBeNull()
  })
})

describe('nutritionAdherencePct', () => {
  it('cumplido=100, parcial=50, no_cumplido=0, promediado', () => {
    expect(nutritionAdherencePct([{ status: 'cumplido' }])).toBe(100)
    expect(nutritionAdherencePct([{ status: 'cumplido' }, { status: 'no_cumplido' }])).toBe(50)
    expect(nutritionAdherencePct([{ status: 'cumplido' }, { status: 'parcial' }])).toBe(75)
  })

  it('sin registros → null (no inventa 0%)', () => {
    expect(nutritionAdherencePct([])).toBeNull()
    expect(nutritionAdherencePct(null)).toBeNull()
  })
})

describe('getWeeklyAdherenceMap', () => {
  it('arma el mapa por cliente desde sesiones, plan y cumplimiento', async () => {
    state.sb = makeSupabase({
      tables: {
        workout_sessions: { data: [{ client_id: 'c1' }, { client_id: 'c1' }], error: null },
        workout_plans: { data: [{ client_id: 'c1', days: [{}, {}, {}, {}] }], error: null },
        nutrition_compliance: {
          data: [{ client_id: 'c1', status: 'cumplido' }, { client_id: 'c1', status: 'parcial' }],
          error: null,
        },
        checkins: { data: [], error: null },
      },
    })
    const map = await getWeeklyAdherenceMap(['c1', 'c2'])
    expect(map.c1).toEqual({ trainingDone: 2, trainingPlanned: 4, training: 50, nutrition: 75 })
    // c2 sin datos: sin % inventados.
    expect(map.c2.training).toBeNull()
    expect(map.c2.nutrition).toBeNull()
  })

  it('sin cumplimiento ni plan, usa el check-in de la semana como fallback', async () => {
    state.sb = makeSupabase({
      tables: {
        workout_sessions: { data: [], error: null },
        workout_plans: { data: [], error: null },
        nutrition_compliance: { data: [], error: null },
        checkins: { data: [{ client_id: 'c1', nutrition_adherence: 80, training_adherence: 60 }], error: null },
      },
    })
    const map = await getWeeklyAdherenceMap(['c1'])
    expect(map.c1.nutrition).toBe(80)
    expect(map.c1.training).toBe(60)
  })

  it('si una query falla, el resto se calcula igual', async () => {
    state.sb = makeSupabase({
      tables: {
        workout_sessions: { data: [{ client_id: 'c1' }], error: null },
        workout_plans: { data: [{ client_id: 'c1', days: [{}, {}] }], error: null },
        nutrition_compliance: { data: null, error: { message: 'boom' } },
        checkins: { data: [], error: null },
      },
    })
    const map = await getWeeklyAdherenceMap(['c1'])
    expect(map.c1.training).toBe(50)
    expect(map.c1.nutrition).toBeNull()
  })

  it('sin ids → mapa vacío sin queries', async () => {
    state.sb = makeSupabase({ tables: {} })
    expect(await getWeeklyAdherenceMap([])).toEqual({})
  })
})
