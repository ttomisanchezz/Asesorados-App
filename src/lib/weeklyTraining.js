import { addDaysKey, recordedWeekKeys, weekStartKey } from './week'

const round = (value) => Math.round((Number(value) || 0) * 100) / 100

function betterSet(a, b) {
  if (!a) return b || null
  if (!b) return a
  const aScore = a.est1rm ?? a.weight ?? 0
  const bScore = b.est1rm ?? b.weight ?? 0
  return bScore > aScore ? b : a
}

function aggregatePoints(points, targetWeek) {
  const map = new Map()
  for (const point of points ?? []) {
    if (weekStartKey(point.date) !== targetWeek) continue
    const current = map.get(point.name) || {
      name: point.name,
      sets: 0,
      topWeight: null,
      maxReps: null,
      volume: 0,
      est1rm: null,
      bestSet: null,
      sessions: new Set(),
    }
    current.sets += point.sets ?? 0
    current.volume += point.volume ?? 0
    if (point.topWeight != null) current.topWeight = current.topWeight == null ? point.topWeight : Math.max(current.topWeight, point.topWeight)
    if (point.maxReps != null) current.maxReps = current.maxReps == null ? point.maxReps : Math.max(current.maxReps, point.maxReps)
    if (point.est1rm != null) current.est1rm = current.est1rm == null ? point.est1rm : Math.max(current.est1rm, point.est1rm)
    current.bestSet = betterSet(current.bestSet, point.bestSet)
    if (point.sessionId) current.sessions.add(point.sessionId)
    map.set(point.name, current)
  }
  return new Map([...map].map(([name, value]) => [name, {
    ...value,
    volume: round(value.volume),
    sessionsCount: value.sessions.size,
  }]))
}

export function compareExercisePerformance(current, previous) {
  if (!current || !previous) return 'no_previous'
  if (current.est1rm != null && previous.est1rm != null) {
    if (current.est1rm > previous.est1rm) return 'improved'
    if (current.est1rm < previous.est1rm) return 'declined'
    return 'maintained'
  }
  if (current.topWeight != null && previous.topWeight != null) {
    if (current.topWeight > previous.topWeight) return 'improved'
    if (current.topWeight < previous.topWeight) return 'declined'
  }
  if (current.maxReps != null && previous.maxReps != null) {
    if (current.maxReps > previous.maxReps) return 'improved'
    if (current.maxReps < previous.maxReps) return 'declined'
    return 'maintained'
  }
  return 'no_previous'
}

export function trainingWeekKeys(history, now = new Date()) {
  return recordedWeekKeys((history?.sessions ?? []).map((session) => session.date), now)
}

export function buildTrainingWeek(history, selectedWeekKey) {
  const weekKey = weekStartKey(selectedWeekKey)
  const previousWeekKey = addDaysKey(weekKey, -7)
  const points = (history?.exercises ?? []).flatMap((exercise) =>
    (exercise.points ?? []).map((point) => ({ ...point, name: exercise.name })),
  )
  const currentMap = aggregatePoints(points, weekKey)
  const previousMap = aggregatePoints(points, previousWeekKey)
  const exercises = [...currentMap.values()].map((current) => {
    const previous = previousMap.get(current.name) || null
    return {
      ...current,
      previous,
      status: compareExercisePerformance(current, previous),
      est1rmDelta: current.est1rm != null && previous?.est1rm != null
        ? round(current.est1rm - previous.est1rm)
        : null,
    }
  }).sort((a, b) => a.name.localeCompare(b.name, 'es'))

  const counts = { improved: 0, maintained: 0, declined: 0, no_previous: 0 }
  exercises.forEach((exercise) => { counts[exercise.status] += 1 })
  const sessions = (history?.sessions ?? []).filter((session) => weekStartKey(session.date) === weekKey)

  return {
    weekKey,
    previousWeekKey,
    sessions,
    exercises,
    summary: {
      sessions: sessions.length,
      totalSets: sessions.reduce((sum, session) => sum + (session.totalSets ?? 0), 0),
      totalVolume: round(sessions.reduce((sum, session) => sum + (session.totalVolume ?? 0), 0)),
      ...counts,
    },
  }
}
