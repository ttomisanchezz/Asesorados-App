import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'

/**
 * Inicia sesión con email y password.
 * En modo demo retorna un error descriptivo.
 */
export async function signIn(email, password) {
  if (!isSupabaseConfigured) {
    return { data: null, error: new Error('Supabase no configurado — modo demo activo') }
  }
  return supabase.auth.signInWithPassword({ email, password })
}

/**
 * Cierra sesión.
 */
export async function signOut() {
  if (!isSupabaseConfigured) return { error: null }
  return supabase.auth.signOut()
}

/**
 * Retorna la sesión activa, o null si no hay.
 */
export async function getSession() {
  if (!isSupabaseConfigured) return { data: { session: null }, error: null }
  return supabase.auth.getSession()
}

/**
 * Lee el perfil del usuario autenticado (rol, nombre).
 */
export async function getMyProfile() {
  if (!isSupabaseConfigured) return { data: null, error: null }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: new Error('No autenticado') }

  return supabase
    .from('profiles')
    .select('id, full_name, role, created_at')
    .eq('id', user.id)
    .single()
}
