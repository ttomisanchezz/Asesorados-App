import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, ClipboardCheck, AlertTriangle, TrendingUp, Clock, ArrowRight, CheckCircle2, Circle, RefreshCw } from 'lucide-react'
import Layout from '../components/layout/Layout'
import StatCard from '../components/ui/StatCard'
import SectionCard from '../components/ui/SectionCard'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import ProgressBar from '../components/ui/ProgressBar'
import { upcomingTasks, recentActivity } from '../data/mockDashboard'
import { mockClients } from '../data/mockClients'
import { getClients } from '../services/clientService'
import { useAuth } from '../context/AuthContext'

const priorityConfig = {
  high: { dot: 'bg-rose-500', text: 'text-rose-400' },
  medium: { dot: 'bg-amber-500', text: 'text-amber-400' },
  low: { dot: 'bg-slate-500', text: 'text-slate-500' },
}

const activityIcons = {
  checkin: CheckCircle2,
  adjust: RefreshCw,
  plan: Circle,
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [clients, setClients] = useState(null)  // null = loading

  useEffect(() => {
    getClients()
      .then(({ data }) => setClients(data ?? []))
      .catch(() => setClients(mockClients))  // fallback silencioso
  }, [])

  // Mientras carga, usar mocks para mostrar algo de inmediato
  const displayClients = clients ?? mockClients

  const activeClients       = displayClients.filter((c) => c.status === 'active')
  const lowAdherenceClients = activeClients.filter(
    (c) => (c.adherenceNutrition < 75 || c.adherenceTraining < 75)
  )
  const avgNutrition  = activeClients.length
    ? Math.round(activeClients.reduce((s, c) => s + (c.adherenceNutrition ?? 0), 0) / activeClients.length)
    : 0
  const avgTraining   = activeClients.length
    ? Math.round(activeClients.reduce((s, c) => s + (c.adherenceTraining ?? 0), 0) / activeClients.length)
    : 0

  return (
    <Layout>
      {/* Greeting */}
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-white tracking-tight">
          Buenos días, Coach <span className="text-gradient">👋</span>
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Semana 21 · {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Asesorados activos"
          value={clients === null ? '—' : activeClients.length}
          sub={clients === null ? 'Cargando...' : `${displayClients.length} total`}
          icon={Users}
          iconColor="text-accent"
        />
        <StatCard
          label="Adherencia nutricional"
          value={clients === null ? '—' : `${avgNutrition}%`}
          sub="promedio activos"
          icon={TrendingUp}
          iconColor="text-emerald-400"
        />
        <StatCard
          label="Adherencia entrenamiento"
          value={clients === null ? '—' : `${avgTraining}%`}
          sub="promedio activos"
          icon={ClipboardCheck}
          iconColor="text-sky-400"
        />
        <StatCard
          label="Baja adherencia"
          value={clients === null ? '—' : lowAdherenceClients.length}
          sub="asesorado/s"
          icon={AlertTriangle}
          iconColor="text-rose-400"
        />
      </div>

      {/* Main grid */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Left col */}
        <div className="lg:col-span-2 flex flex-col gap-4">

          {/* Upcoming tasks */}
          <SectionCard
            title="Tareas próximas"
            subtitle="Esta semana"
            action={
              <Button variant="ghost" size="sm" onClick={() => navigate('/checkins')}>
                Ver todo
              </Button>
            }
          >
            <div className="flex flex-col gap-2">
              {upcomingTasks.slice(0, 5).map((task) => {
                const cfg = priorityConfig[task.priority]
                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors cursor-pointer group"
                    onClick={() => navigate(`/clients/${task.clientId}`)}
                  >
                    <div className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-medium truncate">{task.client}</span>
                        <Badge variant={task.type === 'checkin' ? 'adjust' : 'maintain'}>
                          {task.type === 'checkin' ? 'Check-in' : task.type === 'review' ? 'Revisar' : task.type === 'plan' ? 'Plan' : 'Contacto'}
                        </Badge>
                      </div>
                      <div className="text-slate-500 text-xs mt-0.5 truncate">{task.task}</div>
                    </div>
                    <div className="text-slate-600 text-xs shrink-0">
                      {new Date(task.dueDate).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                    </div>
                    <ArrowRight size={14} className="text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>
                )
              })}
            </div>
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
                      style={{ backgroundColor: c.avatarColor + '22', color: c.avatarColor }}
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

          {/* Recent activity */}
          <SectionCard title="Actividad reciente">
            <div className="flex flex-col gap-2">
              {recentActivity.map((item) => {
                const Icon = activityIcons[item.type] || Circle
                return (
                  <div key={item.id} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => navigate(`/clients/${item.clientId}`)}>
                    <div className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0 mt-0.5">
                      <Icon size={14} className="text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-slate-300 text-sm font-medium">{item.client}</div>
                      <div className="text-slate-500 text-xs">{item.text}</div>
                    </div>
                    <div className="text-slate-600 text-xs shrink-0">{item.time}</div>
                  </div>
                )
              })}
            </div>
          </SectionCard>
        </div>

        {/* Right col */}
        <div className="flex flex-col gap-4">
          {/* Week summary */}
          <SectionCard title="Resumen semanal">
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
                Cargar check-in
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
            <div className="flex flex-col gap-2">
              {displayClients.filter((c) => c.status === 'active').map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.03] transition-colors cursor-pointer"
                  onClick={() => navigate(`/clients/${c.id}`)}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold shrink-0"
                    style={{ backgroundColor: c.avatarColor + '22', color: c.avatarColor }}
                  >
                    {c.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium truncate">{c.name}</div>
                    <div className="text-slate-500 text-xs truncate">{c.objective}</div>
                  </div>
                  <Badge variant={c.status} />
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </Layout>
  )
}
