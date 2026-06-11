import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, ClipboardCheck, AlertTriangle, TrendingUp, ArrowRight, AlertCircle,
} from 'lucide-react'
import Layout from '../components/layout/Layout'
import StatCard from '../components/ui/StatCard'
import SectionCard from '../components/ui/SectionCard'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import ProgressBar from '../components/ui/ProgressBar'
import EmptyState from '../components/ui/EmptyState'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { getClients } from '../services/clientService'
import { getAllRecentCheckins } from '../services/checkinService'

function greeting() {
  const h = new Date().getHours()
  if (h < 13) return 'Buenos días'
  if (h < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

const fmtShort = (iso) =>
  iso ? new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) : null

// Días hasta una fecha (negativo = vencida).
const daysUntil = (iso) =>
  Math.ceil((new Date(iso) - new Date()) / (1000 * 60 * 60 * 24))

export default function Dashboard() {
  const navigate = useNavigate()
  const [clients, setClients] = useState(null)   // null = loading
  const [checkins, setCheckins] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    Promise.allSettled([getClients(), getAllRecentCheckins(8)])
      .then(([cls, chk]) => {
        if (!active) return
        if (cls.status === 'fulfilled' && !cls.value.error) {
          setClients(cls.value.data ?? [])
        } else {
          setClients([])
          setError(cls.status === 'fulfilled' ? cls.value.error?.message : 'No se pudieron cargar los asesorados.')
        }
        setCheckins(chk.status === 'fulfilled' && Array.isArray(chk.value.data) ? chk.value.data : [])
      })
    return () => { active = false }
  }, [])

  if (clients === null) {
    return (
      <Layout>
        <PageLoader label="Cargando tu panel..." />
      </Layout>
    )
  }

  const activeClients       = clients.filter((c) => c.status === 'active')
  const lowAdherenceClients = activeClients.filter(
    (c) => (c.adherenceNutrition < 75 || c.adherenceTraining < 75)
  )
  const avgNutrition  = activeClients.length
    ? Math.round(activeClients.reduce((s, c) => s + (c.adherenceNutrition ?? 0), 0) / activeClients.length)
    : 0
  const avgTraining   = activeClients.length
    ? Math.round(activeClients.reduce((s, c) => s + (c.adherenceTraining ?? 0), 0) / activeClients.length)
    : 0

  // Revisiones próximas reales: clients con next_review programada, vencidas primero.
  const upcomingReviews = activeClients
    .filter((c) => c.nextReview)
    .map((c) => ({ ...c, due: daysUntil(c.nextReview) }))
    .sort((a, b) => a.due - b.due)
    .slice(0, 5)

  return (
    <Layout>
      {/* Greeting */}
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-white tracking-tight">
          {greeting()}, Coach <span className="text-gradient">👋</span>
        </h1>
        <p className="text-slate-500 text-sm mt-1 capitalize">
          {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-rose-500/20 bg-rose-500/[0.06] px-4 py-3">
          <AlertCircle size={15} className="mt-0.5 shrink-0 text-rose-400" />
          <p className="text-sm text-rose-300">{error}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Asesorados activos"
          value={activeClients.length}
          sub={`${clients.length} total`}
          icon={Users}
          iconColor="text-accent"
        />
        <StatCard
          label="Adherencia nutricional"
          value={`${avgNutrition}%`}
          sub="promedio activos"
          icon={TrendingUp}
          iconColor="text-emerald-400"
        />
        <StatCard
          label="Adherencia entrenamiento"
          value={`${avgTraining}%`}
          sub="promedio activos"
          icon={ClipboardCheck}
          iconColor="text-sky-400"
        />
        <StatCard
          label="Baja adherencia"
          value={lowAdherenceClients.length}
          sub="asesorado/s"
          icon={AlertTriangle}
          iconColor="text-rose-400"
        />
      </div>

      {clients.length === 0 && !error ? (
        <EmptyState
          icon={Users}
          title="Todavía no tenés asesorados cargados"
          description="Cuando cargues tus asesorados, este panel va a mostrar su adherencia, revisiones y actividad."
        />
      ) : (
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Left col */}
          <div className="lg:col-span-2 flex flex-col gap-4">

            {/* Upcoming reviews — datos reales de next_review */}
            <SectionCard
              title="Próximas revisiones"
              subtitle="Según la fecha programada de cada asesorado"
              action={
                <Button variant="ghost" size="sm" onClick={() => navigate('/clients')}>
                  Ver todos
                </Button>
              }
            >
              {upcomingReviews.length === 0 ? (
                <p className="py-3 text-sm text-slate-500">
                  No hay revisiones programadas. Podés definir la próxima revisión en la ficha de cada asesorado.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {upcomingReviews.map((c) => {
                    const overdue = c.due <= 0
                    return (
                      <div
                        key={c.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors cursor-pointer group"
                        onClick={() => navigate(`/clients/${c.id}`)}
                      >
                        <div className={`w-2 h-2 rounded-full shrink-0 ${overdue ? 'bg-rose-500' : c.due <= 2 ? 'bg-amber-500' : 'bg-slate-500'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-white text-sm font-medium truncate">{c.name}</span>
                            <Badge variant={overdue ? 'review' : 'maintain'}>
                              {overdue ? 'Vencida' : c.due === 1 ? 'Mañana' : `En ${c.due} días`}
                            </Badge>
                          </div>
                          <div className="text-slate-500 text-xs mt-0.5 truncate">{c.objective || 'Revisión de seguimiento'}</div>
                        </div>
                        <div className="text-slate-600 text-xs shrink-0">{fmtShort(c.nextReview)}</div>
                        <ArrowRight size={14} className="text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </div>
                    )
                  })}
                </div>
              )}
            </SectionCard>

            {/* Low adherence */}
            {lowAdherenceClients.length > 0 && (
              <SectionCard title="Requieren atención" subtitle="Adherencia baja esta semana">
                <div className="flex flex-col gap-3">
                  {lowAdherenceClients.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-rose-500/5 border border-rose-500/10 hover:border-rose-500/20 transition-colors cursor-pointer"
                      onClick={() => navigate(`/clients/${c.id}`)}
                    >
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-semibold shrink-0"
                        style={{ backgroundColor: (c.avatarColor || '#6c63ff') + '22', color: c.avatarColor || '#8b85ff' }}
                      >
                        {c.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm font-medium">{c.name}</div>
                        <div className="flex gap-3 mt-1">
                          <span className="text-xs text-slate-500">
                            Nutrición: <span className="text-amber-400 font-semibold">{c.adherenceNutrition}%</span>
                          </span>
                          <span className="text-xs text-slate-500">
                            Entreno: <span className="text-amber-400 font-semibold">{c.adherenceTraining}%</span>
                          </span>
                        </div>
                      </div>
                      <ArrowRight size={14} className="text-slate-500 shrink-0" />
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Recent checkins — actividad real */}
            <SectionCard title="Últimos check-ins" subtitle="Actividad reciente de tus asesorados">
              {checkins.length === 0 ? (
                <p className="py-3 text-sm text-slate-500">Todavía no hay check-ins registrados.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {checkins.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-white/[0.02] transition-colors cursor-pointer"
                      onClick={() => navigate(`/clients/${c.client_id}`)}
                    >
                      <div className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0 mt-0.5">
                        <ClipboardCheck size={14} className="text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-slate-300 text-sm font-medium truncate">
                          {c.clients?.full_name || 'Asesorado'}
                        </div>
                        <div className="text-slate-500 text-xs">
                          {c.weight != null ? `Peso ${c.weight} kg` : 'Check-in registrado'}
                          {c.decision ? ` · decisión: ${c.decision}` : ''}
                        </div>
                      </div>
                      <div className="text-slate-600 text-xs shrink-0">{fmtShort(c.created_at)}</div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          {/* Right col */}
          <div className="flex flex-col gap-4">
            {/* Week summary */}
            <SectionCard title="Resumen general">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3">
                  <ProgressBar label="Adherencia nutricional prom." value={avgNutrition} color="accent" />
                  <ProgressBar label="Adherencia entrenamiento prom." value={avgTraining} color="emerald" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-white">{activeClients.length}</div>
                    <div className="text-slate-500 text-xs mt-1">Activos</div>
                  </div>
                  <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-white">{lowAdherenceClients.length}</div>
                    <div className="text-slate-500 text-xs mt-1">Baja adh.</div>
                  </div>
                </div>
                {lowAdherenceClients.length > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Necesita atención</span>
                    <span className="text-amber-400 font-semibold truncate ml-2">
                      {lowAdherenceClients[0]?.name?.split(' ')[0]}
                    </span>
                  </div>
                )}
              </div>
            </SectionCard>

            {/* Quick access */}
            <SectionCard title="Acceso rápido">
              <div className="flex flex-col gap-2">
                <Button variant="secondary" className="w-full justify-start" icon={Users} onClick={() => navigate('/clients')}>
                  Ver asesorados
                </Button>
                <Button variant="secondary" className="w-full justify-start" icon={ClipboardCheck} onClick={() => navigate('/checkins')}>
                  Ver check-ins
                </Button>
                <Button variant="secondary" className="w-full justify-start" icon={TrendingUp} onClick={() => navigate('/progress')}>
                  Ver progreso
                </Button>
              </div>
            </SectionCard>

            {/* Clients mini list */}
            <SectionCard
              title="Asesorados activos"
              action={
                <Button variant="ghost" size="sm" onClick={() => navigate('/clients')}>
                  Ver todos
                </Button>
              }
            >
              {activeClients.length === 0 ? (
                <p className="py-2 text-sm text-slate-500">Sin asesorados activos.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {activeClients.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.03] transition-colors cursor-pointer"
                      onClick={() => navigate(`/clients/${c.id}`)}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold shrink-0"
                        style={{ backgroundColor: (c.avatarColor || '#6c63ff') + '22', color: c.avatarColor || '#8b85ff' }}
                      >
                        {c.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm font-medium truncate">{c.name}</div>
                        <div className="text-slate-500 text-xs truncate">{c.objective || 'Sin objetivo definido'}</div>
                      </div>
                      <Badge variant={c.status} />
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      )}
    </Layout>
  )
}
