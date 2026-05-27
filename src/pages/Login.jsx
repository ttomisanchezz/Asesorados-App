import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap, Eye, EyeOff, AlertCircle, Lock } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { isSupabaseConfigured } from '../lib/supabaseClient'

export default function Login() {
  const navigate = useNavigate()
  const { signIn, session, role } = useAuth()

  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [showPass, setShowPass]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const [waitingRole, setWaiting] = useState(false)
  const [error, setError]         = useState(null)

  // Redirect cuando sesión + rol están disponibles (llegan async desde AuthContext)
  useEffect(() => {
    if (session && role && waitingRole) {
      navigate(role === 'coach' ? '/dashboard' : '/mi-panel', { replace: true })
    }
  }, [session, role, waitingRole, navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !password) return

    setLoading(true)
    setError(null)

    const { error: authError } = await signIn(email, password)

    if (authError) {
      setError(resolveError(authError.message))
      setLoading(false)
      return
    }

    // signIn fue exitoso — esperar a que AuthContext cargue el rol
    // El useEffect de arriba se dispara cuando role != null
    setWaiting(true)
    setLoading(false)
  }

  function resolveError(msg) {
    if (msg?.includes('Invalid login credentials')) return 'Email o contraseña incorrectos'
    if (msg?.includes('Email not confirmed'))        return 'Confirmá tu email antes de ingresar'
    if (msg?.includes('no configurado'))             return 'Modo demo — Supabase no está configurado'
    return msg || 'Ocurrió un error al iniciar sesión'
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center">
            <Zap size={22} className="text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-white font-bold text-xl tracking-tight">Asesorados App</h1>
            <p className="text-slate-500 text-sm mt-0.5">Ingresá a tu seguimiento</p>
          </div>
        </div>

        {/* Demo mode notice */}
        {!isSupabaseConfigured && (
          <div className="flex items-start gap-3 p-4 bg-amber-500/8 border border-amber-500/20 rounded-xl mb-5">
            <Lock size={15} className="text-amber-400 shrink-0 mt-0.5" />
            <p className="text-amber-300 text-xs leading-relaxed">
              <span className="font-semibold">Modo demo.</span> Supabase no está configurado — el login no funcionará hasta que agregues las variables de entorno.
            </p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-slate-400 text-xs font-medium mb-1.5 block">
              Email
            </label>
            <input
              type="email"
              autoComplete="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-[#111118] border border-white/[0.08] rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-accent/50 transition-colors"
            />
          </div>

          <div>
            <label className="text-slate-400 text-xs font-medium mb-1.5 block">
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Tu contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 pr-11 bg-[#111118] border border-white/[0.08] rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-accent/50 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 bg-rose-500/8 border border-rose-500/20 rounded-xl">
              <AlertCircle size={15} className="text-rose-400 shrink-0 mt-0.5" />
              <p className="text-rose-300 text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || waitingRole || !email || !password}
            className="w-full py-3 bg-accent hover:bg-accent-dark text-white font-semibold text-sm rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading || waitingRole ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {waitingRole ? 'Redirigiendo...' : 'Ingresando...'}
              </>
            ) : (
              'Ingresar'
            )}
          </button>
        </form>

        {/* Back */}
        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/')}
            className="text-slate-600 hover:text-slate-400 text-xs transition-colors"
          >
            ← Volver al inicio
          </button>
        </div>
      </div>
    </div>
  )
}
