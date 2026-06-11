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

import { getWorkoutPlan, getMyWorkoutPlan } from '../workoutService'

const wrow = {
  id: 'w1',
  title: 'Rutina 2 días — Pierna / Torso',
  days: [{ day: 'Día 1', focus: 'Pierna', exercises: [{ name: 'Sentadilla', sets: '3', reps: '6-10' }] }],
  exercises: [], // columna top-level vacía a propósito (los ejercicios van en days[])
  notes: 'dale',
}

describe('workoutService.normalizeWorkoutPlan', () => {
  it('mapea title → plan y preserva days[] (donde viven los ejercicios)', async () => {
    state.sb = makeSupabase({ tables: { workout_plans: { data: wrow, error: null } } })
    const { data } = await getWorkoutPlan('c1')
    expect(data.plan).toBe('Rutina 2 días — Pierna / Torso')
    expect(data.id).toBe('w1')
    expect(data.days).toHaveLength(1)
    expect(data.days[0].exercises[0].name).toBe('Sentadilla')
  })

  it('getMyWorkoutPlan resuelve por usuario autenticado', async () => {
    state.sb = makeSupabase({
      user: { id: 'u' },
      tables: {
        clients: { data: { id: 'c1' }, error: null },
        workout_plans: { data: wrow, error: null },
      },
    })
    const { data } = await getMyWorkoutPlan()
    expect(data.plan).toBe('Rutina 2 días — Pierna / Torso')
    expect(data.days[0].focus).toBe('Pierna')
  })
})
