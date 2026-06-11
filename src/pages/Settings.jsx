import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Shield, Zap, Loader2 } from 'lucide-react'
import Layout from '../components/layout/Layout'
import PageHeader from '../components/ui/PageHeader'
import SectionCard from '../components/ui/SectionCard'
import Button from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'
import { getMyProfile } from '../services/authService'

const ROLE_LABEL = { coach: 'Coach', client: 'Asesorado' }

export default function Settings() {
  const navigate = useNavigate()
  const { user, role, signOut } = useAuth()
  const [profile, setProfile] = useState(null)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    let active = true
    getMyProfile().then(({ data }) => { if (active) setProfile(data ?? null) })
    return () => { active = false }
  }, [])

  async function handleSignOut() {
    setSigningOut(true)
    await signOut()
    navigate('/', { replace: true })
  }

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Mi cuenta'
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <Layout>
      <PageHeader title="Ajustes" subtitle="Tu cuenta y tu sesión" />

      <div className="max-w-2xl flex flex-col gap-4">
        {/* Profile card — datos reales de la sesión */}
        <div className="bg-[#111118] border border-white/[0.06] rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-accent/20 flex items-center justify-center text-accent font-bold text-xl shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <h2 className="text-white font-semibold text-lg truncate">{displayName}</h2>
              {user?.email && <p className="text-slate-400 text-sm truncate">{user.email}</p>}
              {role && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-accent/10 border border-accent/20 rounded-full">
                    <Zap size={12} className="text-accent" />
                    <span className="text-accent text-xs font-medium">{ROLE_LABEL[role] || role}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <SectionCard title="Cuenta">
          <div className="flex flex-col gap-1">
            {[
              ['Email', user?.email || '—'],
              ['Rol', ROLE_LABEL[role] || role || '—'],
              ['Miembro desde', profile?.created_at
                ? new Date(profile.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
                : '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between py-3 border-b border-white/[0.04] last:border-0">
                <span className="text-slate-300 text-sm">{label}</span>
                <span className="text-slate-500 text-sm text-right">{value}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Seguridad">
          <div className="flex items-start gap-3 rounded-xl bg-white/[0.02] p-3.5 mb-4">
            <Shield size={15} className="mt-0.5 shrink-0 text-slate-500" />
            <p className="text-xs leading-relaxed text-slate-500">
              Tus datos están protegidos con políticas de acceso por fila: cada asesorado solo puede ver y
              modificar su propia información.
            </p>
          </div>
          <Button variant="danger" icon={signingOut ? Loader2 : LogOut} onClick={handleSignOut} disabled={signingOut}>
            {signingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </Button>
        </SectionCard>

        <SectionCard title="Acerca de Asesorados App">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Versión</span>
              <span className="text-white">0.1.0-beta</span>
            </div>
            <div className="mt-1 p-3 bg-accent/5 border border-accent/15 rounded-xl">
              <p className="text-slate-400 text-xs leading-relaxed">
                <span className="text-accent font-medium">Asesorados App</span> es una plataforma de gestión
                para coaching de fitness y nutrición.
              </p>
            </div>
          </div>
        </SectionCard>
      </div>
    </Layout>
  )
}
