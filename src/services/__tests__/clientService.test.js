import { describe, it, expect, vi } from 'vitest'
import { makeSupabase } from './_supabaseMock'

const state = vi.hoisted(() => ({ sb: null }))
vi.mock('../../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: (...a) => state.sb.from(...a),
    auth: { getUser: (...a) => state.sb.auth.getUser(...a) },
  },
}))

import { getClients, getMyClientProfile } from '../clientService'

const snakeRow = {
  id: 'c1', full_name: 'Rocío Adra', email: 'ro@x.com', phone: null,
  objective: 'Recomposición', age: 30, weight: 60, target_weight: 58, height: 165,
  available_days: null, adherence_nutrition: null, adherence_training: null,
  avatar_initials: null, avatar_color: null, created_at: '2026-05-01T10:00:00Z',
}

describe('clientService.normalizeClient (vía getClients)', () => {
  it('mapea snake_case → camelCase y aplica defaults', async () => {
    state.sb = makeSupabase({ tables: { clients: { data: [snakeRow], error: null } } })
    const { data, error, source } = await getClients()
    expect(error).toBeNull()
    expect(source).toBe('supabase')
    const c = data[0]
    expect(c.name).toBe('Rocío Adra')
    expect(c.targetWeight).toBe(58)
    expect(c.availableDays).toEqual([]) // default desde null
    expect(c.adherenceNutrition).toBe(0) // default
    expect(c.status).toBe('active') // default
    expect(c.startDate).toBe('2026-05-01') // created_at recortado
    expect(c.avatar).toBe('RA') // iniciales derivadas del full_name
  })

  it('una fila que ya trae `name` (formato mock) pasa intacta', async () => {
    const mockShape = { id: 'm', name: 'Ya Normal', avatar: 'YN' }
    state.sb = makeSupabase({ tables: { clients: { data: [mockShape], error: null } } })
    const { data } = await getClients()
    expect(data[0]).toEqual(mockShape)
  })

  it('propaga el error de Supabase y deja data en null', async () => {
    state.sb = makeSupabase({ tables: { clients: { data: null, error: { message: 'boom' } } } })
    const { data, error } = await getClients()
    expect(data).toBeNull()
    expect(error).toEqual({ message: 'boom' })
  })

  it('pisa la adherencia estática con la calculada desde los registros de la semana', async () => {
    state.sb = makeSupabase({
      tables: {
        clients: { data: [snakeRow], error: null },
        workout_sessions: { data: [{ client_id: 'c1' }], error: null },
        workout_plans: { data: [{ client_id: 'c1', days: [{}, {}, {}, {}, {}] }], error: null },
        nutrition_compliance: { data: [{ client_id: 'c1', status: 'cumplido' }], error: null },
        checkins: { data: [], error: null },
      },
    })
    const { data } = await getClients()
    const c = data[0]
    expect(c.adherenceTraining).toBe(20) // 1 sesión / 5 días de plan
    expect(c.adherenceNutrition).toBe(100) // 1 día cumplido
    expect(c.weeklyTraining).toEqual({ done: 1, planned: 5 })
  })
})

describe('getMyClientProfile', () => {
  it('resuelve el perfil del usuario autenticado', async () => {
    state.sb = makeSupabase({ user: { id: 'u-ro' }, tables: { clients: { data: snakeRow, error: null } } })
    const { data, error } = await getMyClientProfile()
    expect(error).toBeNull()
    expect(data.name).toBe('Rocío Adra')
  })

  it('sin usuario autenticado → error y data null', async () => {
    state.sb = makeSupabase({ user: null })
    const { data, error } = await getMyClientProfile()
    expect(data).toBeNull()
    expect(error).toBeTruthy()
  })
})
