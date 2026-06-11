import { describe, it, expect } from 'vitest'
import { localDayKey, groupLogsByDay } from './foodLogs'

// Mediodía local de hoy-offset → mismo día local sin importar la zona horaria.
function noonLocal(offsetDays = 0) {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), n.getDate() - offsetDays, 12, 0, 0)
}

describe('localDayKey', () => {
  it('formatea YYYY-MM-DD con componentes locales y padding', () => {
    expect(localDayKey(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05')
    expect(localDayKey(new Date(2026, 11, 31, 1, 0))).toBe('2026-12-31')
  })

  it('usa el día local aunque sea de noche (no se corre a UTC)', () => {
    // 23:30 local de un 9 de junio sigue siendo 2026-06-09
    expect(localDayKey(new Date(2026, 5, 9, 23, 30))).toBe('2026-06-09')
  })
})

describe('groupLogsByDay', () => {
  it('devuelve exactamente `days` días, hoy primero (offset 0..n)', () => {
    const out = groupLogsByDay([], 7)
    expect(out).toHaveLength(7)
    expect(out[0].offset).toBe(0)
    expect(out[6].offset).toBe(6)
  })

  it('agrupa cada comida en su día local y ordena dentro del día (más reciente primero)', () => {
    const logs = [
      { id: 'a', logged_at: noonLocal(0).toISOString() },
      { id: 'b', logged_at: new Date(noonLocal(0).getTime() + 3600_000).toISOString() }, // hoy, 1h después
      { id: 'c', logged_at: noonLocal(1).toISOString() }, // ayer
    ]
    const out = groupLogsByDay(logs, 7)
    expect(out[0].logs.map((l) => l.id)).toEqual(['b', 'a']) // desc por hora
    expect(out[1].logs.map((l) => l.id)).toEqual(['c'])
    expect(out.slice(2).every((d) => d.logs.length === 0)).toBe(true)
  })

  it('usa created_at como fallback de logged_at e ignora comidas sin fecha', () => {
    const logs = [
      { id: 'x', created_at: noonLocal(0).toISOString() },
      { id: 'sin-fecha' },
    ]
    const out = groupLogsByDay(logs, 3)
    expect(out[0].logs.map((l) => l.id)).toEqual(['x'])
    expect(out.flatMap((d) => d.logs)).toHaveLength(1) // la sin fecha se descarta
  })

  it('tolera null/undefined como lista de comidas', () => {
    expect(groupLogsByDay(null, 2)).toHaveLength(2)
    expect(groupLogsByDay(undefined, 2).every((d) => d.logs.length === 0)).toBe(true)
  })
})
