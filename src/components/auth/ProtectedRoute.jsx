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

  // Rol requerido y no coincide → redirigir según rol real
  if (requiredRole && role !== requiredRole) {
    const fallback = role === 'coach' ? '/dashboard' : '/mi-panel'
    return <Navigate to={fallback} replace />
  }

  return children
}
