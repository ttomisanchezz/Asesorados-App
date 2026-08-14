import { describe, expect, it } from 'vitest'
import { combinedAdherenceScore, sortClientsByWeeklyActivity } from './clientRanking'

describe('ranking semanal de asesorados', () => {
  it('calcula el promedio y trata porcentajes faltantes como cero', () => {
    expect(combinedAdherenceScore({ adherenceNutrition: 38, adherenceTraining: 40 })).toBe(39)
    expect(combinedAdherenceScore({ adherenceNutrition: null, adherenceTraining: 40 })).toBe(20)
  })

  it('ordena por adherencia combinada descendente', () => {
    const sorted = sortClientsByWeeklyActivity([
      { id: 'zero', name: 'Cero', adherenceNutrition: 0, adherenceTraining: 0 },
      { id: 'active', name: 'Activo', adherenceNutrition: 38, adherenceTraining: 40 },
    ])
    expect(sorted.map((client) => client.id)).toEqual(['active', 'zero'])
  })

  it('desempata por actividad reciente y luego por nombre estable', () => {
    const sorted = sortClientsByWeeklyActivity([
      { id: 'b', name: 'Bruno', adherenceNutrition: 50, adherenceTraining: 50, lastActivityAt: '2026-08-10' },
      { id: 'c', name: 'Carla', adherenceNutrition: 50, adherenceTraining: 50, lastActivityAt: '2026-08-12' },
      { id: 'a', name: 'Ana', adherenceNutrition: 50, adherenceTraining: 50, lastActivityAt: '2026-08-10' },
    ])
    expect(sorted.map((client) => client.id)).toEqual(['c', 'a', 'b'])
  })
})
