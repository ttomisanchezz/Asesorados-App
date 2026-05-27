import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/**
 * isConfigured: true cuando las env vars están presentes.
 * Cuando es false, los services retornan mock data directamente.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey)

/**
 * Cliente de Supabase — usar únicamente en services, nunca en componentes.
 * Si no está configurado, exportamos null para que los services detecten modo demo.
 */
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null
