import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import { Zap } from 'lucide-react'

/**
 * ProtectedRoute
 *
 * Modo demo (Supabase no configurado) → deja pasar siempre.
 * Modo producción:
 *   - Sin sesión → redirige a /login
 *   - Con rol requerido → verifica que coincida, sino manda a /mi-panel
 */
export default function ProtectedRoute({ children, requiredRole }) {
  const { session, role, loading } = useAuth()

  // Demo mode: no Supabase → pass through
  if (!isSupabaseConfigured) return children

  // Esperando validación de sesión
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-accent flex items-center justify-center animate-pulse">
            <Zap size={20} className="text-white" />
          </div>
          <p className="text-slate-500 text-sm">Verificando sesión...</p>
        </div>
      </div>
    )
  }

  // Sin sesión → login
  if (!session) {
    return <Navigate to="/login" replace />
  }

  // Sesión válida pero sin rol en profiles → cuenta a medio configurar.
  // Sin esto, el redirect a /mi-panel entraría en bucle (la ruta también exige rol).
  if (requiredRole && !role) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/20">
            <Zap size={20} className="text-amber-400" />
          </div>
          <h2 className="text-base font-semibold text-white">Tu cuenta no tiene un perfil asignado</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
            Iniciaste sesión correctamente, pero falta configurar tu rol. Contactá a tu coach para que lo resuelva.
          </p>
        </div>
      </div>
    )
  }

  // Rol requerido y no coincide → redirigir según rol real
  if (requiredRole && role !== requiredRole) {
    const fallback = role === 'coach' ? '/dashboard' : '/mi-panel'
    return <Navigate to={fallback} replace />
  }

  return children
}
