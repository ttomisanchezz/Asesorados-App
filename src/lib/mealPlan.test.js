import { describe, it, expect } from 'vitest'
import { normalizeMealPlan } from './mealPlan'

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
