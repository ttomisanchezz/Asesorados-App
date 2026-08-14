import { enumerateMeals, normalizeMealPlan } from './mealPlan'
import { localDateKey, recordedWeekKeys, weekDays, weekStartKey } from './week'

const normalize = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()

function planCreatedAt(plan) {
  return plan?.createdAt || plan?.created_at || null
}

function planForDate(plans, dayKey) {
  const ordered = [...(plans ?? [])].sort(
    (a, b) => new Date(planCreatedAt(a) || 0) - new Date(planCreatedAt(b) || 0),
  )
  const endOfDay = new Date(`${dayKey}T23:59:59`)
  const eligible = ordered.filter((plan) => {
    const created = planCreatedAt(plan)
    return !created || new Date(created) <= endOfDay
  })
  return eligible.at(-1) || null
}

function logMatchesMeal(log, mealName) {
  const label = normalize(log?.meal_label)
  const meal = normalize(mealName)
  return Boolean(label && meal && (label === meal || label.includes(meal) || meal.includes(label)))
}

function fallbackComplianceScore(rows) {
  if (!rows.length) return null
  const score = rows.reduce((sum, row) => {
    if (row.meals_total > 0) return sum + Math.min(1, (row.meals_done ?? 0) / row.meals_total)
    if (row.status === 'cumplido') return sum + 1
    if (row.status === 'parcial') return sum + 0.5
    return sum
  }, 0)
  return Math.round((score / rows.length) * 100)
}

export function nutritionWeekKeys({ compliance = [], logs = [], mealChecks = [] }, now = new Date()) {
  const dates = [
    ...compliance.map((row) => row.log_date || row.created_at),
    ...logs.map((row) => row.logged_at || row.created_at),
    ...mealChecks.map((row) => row.log_date || row.created_at),
  ].filter(Boolean)
  return recordedWeekKeys(dates, now)
}

export function buildNutritionWeek({ weekKey, plans = [], compliance = [], logs = [], mealChecks = [] }) {
  const days = weekDays(weekKey).map(({ key, date, index }) => {
    const plan = planForDate(plans, key)
    const normalizedPlan = plan ? normalizeMealPlan(plan) : null
    const enumerated = normalizedPlan ? enumerateMeals(normalizedPlan, date) : { meals: [], todayTotal: 0 }
    const plannedMeals = enumerated.meals.filter((meal) => meal.today)
    const checks = mealChecks.filter((row) => row.log_date === key)
    const dayLogs = logs.filter((row) => localDateKey(row.logged_at || row.created_at) === key)
    const usedLogIds = new Set()

    const meals = plannedMeals.map((meal) => {
      const check = checks.find((row) => row.meal_key === meal.key)
      const matchingLogs = dayLogs.filter((log) => logMatchesMeal(log, meal.mealName))
      matchingLogs.forEach((log) => usedLogIds.add(log.id))
      const option = check
        ? normalizedPlan?.schemes?.[meal.schemeIndex]?.meals?.[meal.mealIndex]?.options?.[check.option_index] ?? null
        : null
      if (check) return { ...meal, state: 'planned', check, option, logs: matchingLogs }
      if (matchingLogs.length) return { ...meal, state: 'free', check: null, logs: matchingLogs }
      return { ...meal, state: 'missing', check: null, logs: [] }
    })

    const extraLogs = dayLogs.filter((log) => !usedLogIds.has(log.id))
    const complianceRow = compliance.find((row) => row.log_date === key) || null
    return {
      key,
      date,
      index,
      plan,
      meals,
      extraLogs,
      compliance: complianceRow,
      planned: meals.length,
      fulfilled: meals.filter((meal) => meal.state === 'planned').length,
      outsidePlan: meals.filter((meal) => meal.state === 'free').length + extraLogs.length,
      hasActivity: checks.length > 0 || dayLogs.length > 0 || Boolean(complianceRow),
    }
  })

  const planned = days.reduce((sum, day) => sum + day.planned, 0)
  const fulfilled = days.reduce((sum, day) => sum + day.fulfilled, 0)
  const outsidePlan = days.reduce((sum, day) => sum + day.outsidePlan, 0)
  const complianceRows = days.map((day) => day.compliance).filter(Boolean)
  const hasGranularChecks = days.some((day) => day.meals.some((meal) => meal.check))
  const adherence = planned > 0 && hasGranularChecks
    ? Math.round((fulfilled / planned) * 100)
    : fallbackComplianceScore(complianceRows)

  return {
    weekKey: weekStartKey(weekKey),
    days,
    summary: {
      adherence,
      fulfilled,
      planned,
      outsidePlan,
      daysWithActivity: days.filter((day) => day.hasActivity).length,
    },
  }
}
