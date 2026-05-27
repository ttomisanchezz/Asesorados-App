import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { mockClients } from '../data/mockClients'

/**
 * Retorna la lista de clientes del coach autenticado.
 * Fallback: mock data cuando Supabase no está configurado.
 */
export async function getClients() {
  if (!isSupabaseConfigured) {
    return { data: mockClients, error: null, source: 'mock' }
  }

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('full_name', { ascending: true })

  return { data, error, source: 'supabase' }
}

/**
 * Retorna un cliente por ID con sus relaciones principales.
 */
export async function getClientById(id) {
  if (!isSupabaseConfigured) {
    const client = mockClients.find((c) => c.id === id)
    return {
      data: client ?? null,
      error: client ? null : new Error('Cliente no encontrado'),
      source: 'mock',
    }
  }

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single()

  return { data, error, source: 'supabase' }
}

/**
 * Retorna el perfil del asesorado autenticado (su propio registro).
 * Usa user_id = auth.uid() para que el asesorado solo vea sus datos.
 */
export async function getMyClientProfile() {
  if (!isSupabaseConfigured) {
    // Demo: retorna el primer asesorado activo
    const client = mockClients.find((c) => c.status === 'active')
    return { data: client ?? null, error: null, source: 'mock' }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: new Error('No autenticado'), source: 'supabase' }

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return { data, error, source: 'supabase' }
}

/**
 * Crea un nuevo cliente.
 */
export async function createClient(payload) {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error('Requiere Supabase configurado') }
  }

  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('clients')
    .insert({ ...payload, coach_id: user.id })
    .select()
    .single()

  return { data, error }
}

/**
 * Actualiza un cliente existente.
 */
export async function updateClient(id, payload) {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error('Requiere Supabase configurado') }
  }

  const { data, error } = await supabase
    .from('clients')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  return { data, error }
}
