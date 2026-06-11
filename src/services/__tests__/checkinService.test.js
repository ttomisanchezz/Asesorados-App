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

import { getCheckins } from '../checkinService'

const ckRow = {
  id: 'k1', created_at: '2026-06-07T10:00:00Z', weight: 75,
  energy: 4, hunger: 2, sleep: 3, stress: 2,
  nutrition_adherence: 90, training_adherence: 80,
  client_comment: 'bien', coach_feedback: null, decision: 'maintain',
}

describe('checkinService.normalizeCheckin', () => {
  it('mapea snake_case → camelCase y recorta la fecha', async () => {
    state.sb = makeSupabase({ tables: { checkins: { data: [ckRow], error: null } } })
    const { data } = await getCheckins('c1')
    const k = data[0]
    expect(k.date).toBe('2026-06-07')
    expect(k.nutritionAdherence).toBe(90)
    expect(k.trainingAdherence).toBe(80)
    expect(k.clientComment).toBe('bien')
    expect(k.coachFeedback).toBeNull()
    expect(k.decision).toBe('maintain')
  })

  it('ante error de Supabase devuelve lista vacía', async () => {
    state.sb = makeSupabase({ tables: { checkins: { data: null, error: { message: 'x' } } } })
    const { data } = await getCheckins('c1')
    expect(data).toEqual([])
  })
})
