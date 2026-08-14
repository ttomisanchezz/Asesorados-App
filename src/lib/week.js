const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/

export function localDateKey(dateLike = new Date()) {
  if (typeof dateLike === 'string' && DATE_KEY_RE.test(dateLike)) return dateLike
  const date = new Date(dateLike)
  if (Number.isNaN(date.getTime())) return null
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function dateFromLocalKey(key) {
  if (!DATE_KEY_RE.test(String(key ?? ''))) return null
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function addDaysKey(key, amount) {
  const date = dateFromLocalKey(key)
  if (!date) return null
  date.setDate(date.getDate() + amount)
  return localDateKey(date)
}

export function weekStartKey(dateLike = new Date()) {
  const key = localDateKey(dateLike)
  const date = dateFromLocalKey(key)
  if (!date) return null
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return localDateKey(date)
}

export function weekDays(weekKey) {
  return Array.from({ length: 7 }, (_, index) => {
    const key = addDaysKey(weekKey, index)
    return { key, date: dateFromLocalKey(key), index }
  })
}

export function formatWeekRange(weekKey) {
  const start = dateFromLocalKey(weekKey)
  const endKey = addDaysKey(weekKey, 6)
  const end = dateFromLocalKey(endKey)
  if (!start || !end) return ''
  const sameYear = start.getFullYear() === end.getFullYear()
  const startLabel = start.toLocaleDateString('es-AR', {
    day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }),
  })
  const endLabel = end.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${startLabel} — ${endLabel}`
}

export function recordedWeekKeys(dateLikes, now = new Date()) {
  const keys = new Set([weekStartKey(now)])
  for (const value of dateLikes ?? []) {
    const key = weekStartKey(value)
    if (key) keys.add(key)
  }
  return [...keys].sort()
}
