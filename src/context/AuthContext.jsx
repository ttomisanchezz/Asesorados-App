import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'

const AuthContext = createContext(null)

/**
 * AuthProvider — envuelve toda la app.
 *
 * En modo demo (sin Supabase configurado):
 *   user = null, role = null, loading = false — la app funciona sin auth.
 *
 * En modo producción:
 *   Escucha cambios de sesión, lee el rol desde profiles, protege rutas.
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser]       = useState(null)
  const [role, setRole]       = useState(null)   // 'coach' | 'client' | null
  // En modo demo (sin Supabase) no hay nada que cargar.
  const [loading, setLoading] = useState(isSupabaseConfigured)

  async function fetchRole(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()

      if (error) throw error
      setRole(data?.role ?? null)
    } catch {
      setRole(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isSupabaseConfigured) return

    // Leer sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchRole(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Escuchar cambios de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          fetchRole(session.user.id)
        } else {
          setRole(null)
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email, password) => {
    if (!isSupabaseConfigured) {
      return { error: new Error('Supabase no configurado — modo demo activo') }
    }
    return supabase.auth.signInWithPassword({ email, password })
  }

  const signOut = async () => {
    if (!isSupabaseConfigured) return
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    setRole(null)
  }

  return (
    <AuthContext.Provider value={{ session, user, role, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

// El provider y el hook viven juntos a propósito: separar useAuth en otro
// archivo solo para satisfacer fast-refresh complica los imports del resto
// de la app. El costo es que un edit acá recarga la página completa en dev.
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
