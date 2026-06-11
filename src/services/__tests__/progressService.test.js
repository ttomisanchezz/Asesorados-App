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

import { getProgressMetrics } from '../progressService'

// Llegan desc por fecha (como en prod); normalizeProgress los reordena ascendente.
const rows = [
  { id: 'p2', weight: 78, created_at: '2026-02-01T12:00:00Z', waist: 88, chest: null, hip: null, arm: null, leg: null, notes: null },
  { id: 'p1', weight: 80, created_at: '2026-01-01T12:00:00Z', waist: 90, chest: 100, hip: 95, arm: 35, leg: 55, notes: 'base' },
]

describe('progressService.normalizeProgress', () => {
  it('ordena ascendente, arma weightHistory y toma measurements del más reciente', async () => {
    state.sb = makeSupabase({ tables: { progress_metrics: { data: rows, error: null } } })
    const { data } = await getProgressMetrics('c1')
    expect(data.count).toBe(2)
    expect(data.weightHistory).toEqual([80, 78]) // ascendente por created_at
    expect(data.points.map((p) => p.id)).toEqual(['p1', 'p2'])
    expect(data.measurements.waist).toBe(88) // del registro más reciente (p2)
  })

  it('descarta registros sin peso del weightHistory pero los cuenta', async () => {
    const mixed = [
      { id: 'a', weight: null, created_at: '2026-01-02T12:00:00Z' },
      { id: 'b', weight: 70, created_at: '2026-01-01T12:00:00Z' },
    ]
    state.sb = makeSupabase({ tables: { progress_metrics: { data: mixed, error: null } } })
    const { data } = await getProgressMetrics('c1')
    expect(data.weightHistory).toEqual([70])
    expect(data.count).toBe(2)
  })

  it('sin registros → data null', async () => {
    state.sb = makeSupabase({ tables: { progress_metrics: { data: [], error: null } } })
    const { data } = await getProgressMetrics('c1')
    expect(data).toBeNull()
  })
})
