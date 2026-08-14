import { describe, expect, it } from 'vitest'
import { buildNutritionWeek, nutritionWeekKeys } from './weeklyNutrition'

const plan = {
  active: true,
  createdAt: '2026-07-01T12:00:00Z',
  meals: [{
    scheme: 'Diario',
    meals: [
      { name: 'Desayuno', options: [{ title: 'Opción 1', items: ['Avena'] }] },
      { name: 'Cena', options: [{ title: 'Opción 1', items: ['Pollo'] }] },
    ],
  }],
}

describe('seguimiento nutricional semanal', () => {
  it('agrupa lunes a domingo y distingue plan, registro libre y ausencia', () => {
    const week = buildNutritionWeek({
      weekKey: '2026-08-10',
      plans: [plan],
      mealChecks: [{ id: 'c1', log_date: '2026-08-10', meal_key: '0:0', option_title: 'Opción 1' }],
      logs: [{ id: 'l1', logged_at: '2026-08-10T21:00:00', meal_label: 'Cena', description: 'Pizza' }],
    })
    expect(week.days).toHaveLength(7)
    expect(week.days[0].meals.map((meal) => meal.state)).toEqual(['planned', 'free'])
    expect(week.summary).toMatchObject({ fulfilled: 1, planned: 14, outsidePlan: 1 })
  })

  it('incluye la semana actual y todas las semanas con actividad', () => {
    const keys = nutritionWeekKeys({
      compliance: [], mealChecks: [],
      logs: [{ logged_at: '2026-07-21T12:00:00', description: 'Comida' }],
    }, new Date(2026, 7, 14))
    expect(keys).toEqual(['2026-07-20', '2026-08-10'])
  })
})
