import { vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock mínimo y reutilizable del cliente de Supabase para testear los services
// SIN red. Reproduce el query builder encadenable (.from().select().eq()...) y
// `auth`. Cada `.from(tabla)` consume la próxima respuesta encolada para esa
// tabla, así un service que hace 2 queries a la misma tabla recibe 2 respuestas
// en orden.
//
// Uso:
//   const sb = makeSupabase({
//     user: { id: 'user-1' },
//     tables: {
//       clients:         { data: rowSnakeCase, error: null },        // 1 respuesta
//       nutrition_plans: [{ data: a }, { data: b }],                  // cola de 2
//     },
//   })
// ---------------------------------------------------------------------------
export function makeSupabase({ user = { id: 'user-1' }, tables = {} } = {}) {
  const queues = {}
  for (const [table, value] of Object.entries(tables)) {
    queues[table] = Array.isArray(value) ? [...value] : [value]
  }

  const next = (table) => {
    const q = queues[table]
    if (!q || q.length === 0) {
      throw new Error(`Mock Supabase: sin respuesta encolada para la tabla "${table}"`)
    }
    return q.shift()
  }

  const builder = (table) => {
    const resolve = () => Promise.resolve(next(table))
    const b = {
      select: () => b, insert: () => b, update: () => b, upsert: () => b, delete: () => b,
      eq: () => b, neq: () => b, gte: () => b, lte: () => b, in: () => b, is: () => b,
      order: () => b, limit: () => b, range: () => b,
      single: () => resolve(),
      maybeSingle: () => resolve(),
      // hace al builder "thenable": permite `await supabase.from(t).select()...`
      then: (onFulfilled, onRejected) => resolve().then(onFulfilled, onRejected),
    }
    return b
  }

  return {
    from: (table) => builder(table),
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user }, error: null })),
      getSession: vi.fn(() =>
        Promise.resolve({ data: { session: user ? { user } : null }, error: null }),
      ),
      signInWithPassword: vi.fn(() => Promise.resolve({ data: { user }, error: null })),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
    },
  }
}

// Construye el objeto-módulo que reemplaza a ../../lib/supabaseClient.
// `state` es un holder mutable (creado con vi.hoisted en cada test) para poder
// cambiar el mock por test sin re-mockear el módulo.
export function supabaseModule(state) {
  return {
    isSupabaseConfigured: true,
    supabase: {
      from: (...a) => state.sb.from(...a),
      auth: {
        getUser: (...a) => state.sb.auth.getUser(...a),
        getSession: (...a) => state.sb.auth.getSession(...a),
        signInWithPassword: (...a) => state.sb.auth.signInWithPassword(...a),
        signOut: (...a) => state.sb.auth.signOut(...a),
      },
    },
  }
}
