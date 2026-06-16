import { describe, it, expect } from 'vitest'
import { normalizeMealPlan, enumerateMeals } from './mealPlan'

const meal = (name) => ({ name, options: [{ title: 'Opción', items: ['pollo'], kcal: 500 }] })

describe('normalizeMealPlan', () => {
  it('sin plan / sin comidas → empty', () => {
    expect(normalizeMealPlan(null).type).toBe('empty')
    expect(normalizeMealPlan({}).type).toBe('empty')
    expect(normalizeMealPlan({ meals: [] }).type).toBe('empty')
  })

  it('meals como texto libre no vacío → plain (texto trimmeado)', () => {
    const r = normalizeMealPlan({ meals: '  comer sano  ' })
    expect(r.type).toBe('plain')
    expect(r.text).toBe('comer sano')
  })

  it('meals como texto vacío → empty', () => {
    expect(normalizeMealPlan({ meals: '   ' }).type).toBe('empty')
  })

  it('un solo esquema con comidas → daily', () => {
    const plan = { meals: [{ scheme: 'Único', meals: [meal('Desayuno')] }] }
    const r = normalizeMealPlan(plan)
    expect(r.type).toBe('daily')
    expect(r.weekly).toBe(false)
    expect(r.schemes).toHaveLength(1)
  })

  it('varios esquemas → grouped', () => {
    const plan = {
      meals: [
        { scheme: 'Entreno', meals: [meal('Almuerzo')] },
        { scheme: 'Descanso', meals: [meal('Cena')] },
      ],
    }
    expect(normalizeMealPlan(plan).type).toBe('grouped')
  })

  it('esquemas con nombres de día de la semana → weekly true', () => {
    const plan = {
      meals: [
        { scheme: 'Lunes', meals: [meal('Desayuno')] },
        { scheme: 'Martes', meals: [meal('Cena')] },
      ],
    }
    const r = normalizeMealPlan(plan)
    expect(r.weekly).toBe(true)
    expect(r.type).toBe('grouped')
  })

  it('descarta comidas sin opciones; si no queda ninguna → empty', () => {
    const plan = { meals: [{ scheme: 'X', meals: [{ name: 'Vacía', options: [] }] }] }
    expect(normalizeMealPlan(plan).type).toBe('empty')
  })
})

describe('enumerateMeals', () => {
  it('empty / plain → sin comidas y total 0', () => {
    expect(enumerateMeals(normalizeMealPlan(null))).toEqual({ meals: [], todayTotal: 0 })
    expect(enumerateMeals(normalizeMealPlan({ meals: 'texto' }))).toEqual({ meals: [], todayTotal: 0 })
  })

  it('plan diario → todas las comidas son de hoy con claves estables', () => {
    const mp = normalizeMealPlan({ meals: [{ scheme: 'Único', meals: [meal('Desayuno'), meal('Almuerzo')] }] })
    const { meals, todayTotal } = enumerateMeals(mp)
    expect(todayTotal).toBe(2)
    expect(meals.map((m) => m.key)).toEqual(['0:0', '0:1'])
    expect(meals.every((m) => m.today)).toBe(true)
  })

  it('varios esquemas no-semanales → todas marcables (no se sabe cuál aplica hoy)', () => {
    const mp = normalizeMealPlan({
      meals: [
        { scheme: 'Entreno', meals: [meal('Almuerzo')] },
        { scheme: 'Descanso', meals: [meal('Cena')] },
      ],
    })
    const { meals, todayTotal } = enumerateMeals(mp)
    expect(todayTotal).toBe(2)
    expect(meals.every((m) => m.today)).toBe(true)
  })

  it('plan semanal → solo las comidas del día de hoy cuentan', () => {
    const mp = normalizeMealPlan({
      meals: [
        { scheme: 'Lunes', meals: [meal('Desayuno'), meal('Cena')] },
        { scheme: 'Martes', meals: [meal('Almuerzo')] },
      ],
    })
    // Un lunes cualquiera: solo el esquema "Lunes" (2 comidas) es de hoy.
    const lunes = new Date('2026-06-15T12:00:00') // 2026-06-15 es lunes
    const r = enumerateMeals(mp, lunes)
    expect(r.todayTotal).toBe(2)
    expect(r.meals.filter((m) => m.today).map((m) => m.key)).toEqual(['0:0', '0:1'])
  })

  it('plan semanal sin el día de hoy → no hay comidas de hoy', () => {
    const mp = normalizeMealPlan({
      meals: [{ scheme: 'Lunes', meals: [meal('Desayuno')] }],
    })
    const martes = new Date('2026-06-16T12:00:00') // martes, no está en el plan
    expect(enumerateMeals(mp, martes).todayTotal).toBe(0)
  })
})
