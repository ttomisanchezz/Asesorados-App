import { describe, it, expect } from 'vitest'
import { parseSetsCount } from '../workoutLogService'

// parseSetsCount es pura (no toca Supabase) → no requiere mock.
describe('parseSetsCount', () => {
  it('número simple → ese número', () => {
    expect(parseSetsCount('3')).toBe(3)
    expect(parseSetsCount(4)).toBe(4)
  })

  it('rango "3-4" → toma el mayor', () => {
    expect(parseSetsCount('3-4')).toBe(4)
    expect(parseSetsCount('2-5')).toBe(5)
  })

  it('null/sin dígitos → fallback (1 por defecto)', () => {
    expect(parseSetsCount(null)).toBe(1)
    expect(parseSetsCount('AMRAP')).toBe(1)
    expect(parseSetsCount('al fallo')).toBe(1)
  })

  it('respeta un fallback custom', () => {
    expect(parseSetsCount(null, 3)).toBe(3)
    expect(parseSetsCount('x', 2)).toBe(2)
  })

  it('"0" cae al fallback (no permite 0 series para poder registrar al menos una)', () => {
    expect(parseSetsCount('0')).toBe(1)
  })
})
