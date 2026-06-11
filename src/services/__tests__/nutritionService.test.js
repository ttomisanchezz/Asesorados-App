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

import { getNutritionPlan, getMyNutritionPlan } from '../nutritionService'

const planRow = {
  calories: 1900, protein: 97, carbs: 283, fats: 42,
  meals: [{ name: 'Almuerzo' }], notes: 'ok', updated_at: '2026-06-07T10:00:00Z',
}

describe('nutritionService.normalizeNutritionPlan', () => {
  it('mapea fats → fat (gotcha conocido) y recorta updated_at', async () => {
    state.sb = makeSupabase({ tables: { nutrition_plans: { data: planRow, error: null } } })
    const { data } = await getNutritionPlan('c1')
    expect(data.fat).toBe(42) // Supabase: fats → UI: fat
    expect(data.protein).toBe(97)
    expect(data.lastUpdate).toBe('2026-06-07')
  })

  it('macros en null NO se inventan (quedan null)', async () => {
    const nullMacros = { calories: null, protein: null, carbs: null, fats: null, meals: [], updated_at: null }
    state.sb = makeSupabase({ tables: { nutrition_plans: { data: nullMacros, error: null } } })
    const { data } = await getNutritionPlan('c1')
    expect(data.fat).toBeNull()
    expect(data.protein).toBeNull()
    expect(data.calories).toBeNull()
  })

  it('getMyNutritionPlan adjunta el objetivo (que vive en clients)', async () => {
    state.sb = makeSupabase({
      user: { id: 'u' },
      tables: {
        clients: { data: { id: 'c1', objective: 'Volumen' }, error: null },
        nutrition_plans: { data: planRow, error: null },
      },
    })
    const { data } = await getMyNutritionPlan()
    expect(data.objective).toBe('Volumen')
    expect(data.fat).toBe(42)
  })
})
