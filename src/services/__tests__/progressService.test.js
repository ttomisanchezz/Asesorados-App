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

import { getProgressMetrics, addMyMeasurements } from '../progressService'

// Llegan desc por fecha (como en prod); normalizeProgress los reordena ascendente.
const rows = [
  { id: 'p2', weight: 78, created_at: '2026-02-01T12:00:00Z', waist: 88, chest: null, hip: null, arm: null, leg: null, notes: null },
  { id: 'p1', weight: 80, created_at: '2026-01-01T12:00:00Z', waist: 90, chest: 100, hip: 95, arm: 35, leg: 55, notes: 'base' },
]

describe('progressService.normalizeProgress', () => {
  it('ordena ascendente, arma weightHistory y toma la última medida POR CAMPO', async () => {
    state.sb = makeSupabase({ tables: { progress_metrics: { data: rows, error: null } } })
    const { data } = await getProgressMetrics('c1')
    expect(data.count).toBe(2)
    expect(data.weightHistory).toEqual([80, 78]) // ascendente por created_at
    expect(data.points.map((p) => p.id)).toEqual(['p1', 'p2'])
    expect(data.measurements.waist).toBe(88) // del registro más reciente (p2)
    expect(data.measurements.chest).toBe(100) // p2 no la trae → cae al último valor real (p1)
    expect(data.measurements.arm).toBe(35)
  })

  it('measurementPoints: historial ascendente solo con filas que tienen medidas', async () => {
    const mixed = [
      { id: 'm3', weight: 77, created_at: '2026-03-01T12:00:00Z' }, // solo peso → fuera
      { id: 'm2', weight: null, created_at: '2026-02-01T12:00:00Z', waist: 87, arm: 34 },
      { id: 'm1', weight: 80, created_at: '2026-01-01T12:00:00Z', waist: 90, chest: 100 },
    ]
    state.sb = makeSupabase({ tables: { progress_metrics: { data: mixed, error: null } } })
    const { data } = await getProgressMetrics('c1')
    expect(data.measurementPoints.map((p) => p.id)).toEqual(['m1', 'm2'])
    expect(data.measurementPoints[1]).toMatchObject({ waist: 87, arm: 34, chest: null })
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

describe('addMyMeasurements', () => {
  const clientRow = { data: { id: 'c1', coach_id: 'coach-1' }, error: null }

  it('inserta una fila nueva cuando no hay registro ese día', async () => {
    const inserted = { id: 'p9', client_id: 'c1', waist: 88, arm: 35, chest: 100 }
    state.sb = makeSupabase({
      tables: {
        clients: clientRow,
        progress_metrics: [
          { data: [], error: null },       // búsqueda del registro del día
          { data: inserted, error: null }, // insert
        ],
      },
    })
    const { data, error, updated } = await addMyMeasurements({ date: '2026-06-12', waist: 88, arm: 35, chest: 100 })
    expect(error).toBeNull()
    expect(updated).toBe(false)
    expect(data).toEqual(inserted)
  })

  it('actualiza el registro existente del día (no duplica)', async () => {
    state.sb = makeSupabase({
      tables: {
        clients: clientRow,
        progress_metrics: [
          { data: [{ id: 'p5' }], error: null },          // ya hay registro ese día
          { data: { id: 'p5', waist: 87 }, error: null }, // update
        ],
      },
    })
    const { error, updated } = await addMyMeasurements({ date: '2026-06-12', waist: 87 })
    expect(error).toBeNull()
    expect(updated).toBe(true)
  })

  it('sin ninguna medida → error sin tocar la base', async () => {
    state.sb = makeSupabase({ tables: {} })
    const { error } = await addMyMeasurements({ date: '2026-06-12' })
    expect(error).toBeTruthy()
  })
})
