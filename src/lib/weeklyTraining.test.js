import { describe, expect, it } from 'vitest'
import { buildTrainingWeek, compareExercisePerformance } from './weeklyTraining'

describe('comparación semanal de rendimiento', () => {
  it('clasifica usando 1RM estimado y no volumen como señal principal', () => {
    expect(compareExercisePerformance({ est1rm: 110, volume: 1000 }, { est1rm: 100, volume: 2000 })).toBe('improved')
    expect(compareExercisePerformance({ est1rm: 100 }, { est1rm: 100 })).toBe('maintained')
    expect(compareExercisePerformance({ est1rm: 90 }, { est1rm: 100 })).toBe('declined')
    expect(compareExercisePerformance({ est1rm: 90 }, null)).toBe('no_previous')
  })

  it('compara contra la semana calendario inmediatamente anterior', () => {
    const history = {
      sessions: [
        { id: 's1', date: '2026-08-03T12:00:00', totalSets: 3, totalVolume: 2400 },
        { id: 's2', date: '2026-08-10T12:00:00', totalSets: 3, totalVolume: 2700 },
      ],
      exercises: [{
        name: 'Sentadilla',
        points: [
          { date: '2026-08-03T12:00:00', sessionId: 's1', sets: 3, topWeight: 80, maxReps: 10, volume: 2400, est1rm: 106.67, bestSet: { weight: 80, reps: 10, est1rm: 106.67 } },
          { date: '2026-08-10T12:00:00', sessionId: 's2', sets: 3, topWeight: 90, maxReps: 10, volume: 2700, est1rm: 120, bestSet: { weight: 90, reps: 10, est1rm: 120 } },
        ],
      }],
    }
    const week = buildTrainingWeek(history, '2026-08-10')
    expect(week.previousWeekKey).toBe('2026-08-03')
    expect(week.exercises[0]).toMatchObject({ status: 'improved', est1rmDelta: 13.33 })
    expect(week.summary.improved).toBe(1)
  })
})
