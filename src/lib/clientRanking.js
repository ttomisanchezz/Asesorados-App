const pct = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export function combinedAdherenceScore(client) {
  return (pct(client?.adherenceNutrition) + pct(client?.adherenceTraining)) / 2
}

function activityTime(client) {
  const value = client?.lastActivityAt || client?.lastCheckin || client?.updatedAt || client?.startDate
  const time = value ? new Date(value).getTime() : 0
  return Number.isFinite(time) ? time : 0
}

export function sortClientsByWeeklyActivity(clients) {
  return (clients ?? [])
    .map((client, index) => ({ client, index }))
    .sort((a, b) => {
      const scoreDelta = combinedAdherenceScore(b.client) - combinedAdherenceScore(a.client)
      if (scoreDelta !== 0) return scoreDelta
      const activityDelta = activityTime(b.client) - activityTime(a.client)
      if (activityDelta !== 0) return activityDelta
      const nameDelta = String(a.client?.name ?? '').localeCompare(String(b.client?.name ?? ''), 'es')
      return nameDelta || a.index - b.index
    })
    .map(({ client }) => client)
}
