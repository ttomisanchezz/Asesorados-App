import { CheckCircle2, Clock, ClipboardCheck, MessageSquare, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import Layout from '../components/layout/Layout'
import PageHeader from '../components/ui/PageHeader'
import SectionCard from '../components/ui/SectionCard'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import ProgressBar from '../components/ui/ProgressBar'
import { mockCheckins } from '../data/mockCheckins'
import { mockClients } from '../data/mockClients'

const RATINGS = {
  1: { label: 'Muy bajo', color: 'text-rose-400' },
  2: { label: 'Bajo', color: 'text-orange-400' },
  3: { label: 'Regular', color: 'text-amber-400' },
  4: { label: 'Bueno', color: 'text-emerald-400' },
  5: { label: 'Excelente', color: 'text-emerald-400' },
}

const decisionConfig = {
  maintain: { label: 'Mantener', variant: 'maintain', icon: Minus },
  adjust: { label: 'Ajustar', variant: 'adjust', icon: TrendingDown },
  review: { label: 'Revisar', variant: 'review', icon: TrendingUp },
}

function RatingBar({ value, label }) {
  const colors = ['', 'rose', 'orange', 'amber', 'emerald', 'emerald']
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-slate-500 text-xs">{label}</span>
        <span className={`text-xs font-semibold text-${colors[value]}-400`}>
          {RATINGS[value]?.label}
        </span>
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`flex-1 h-1.5 rounded-full ${
              i <= value ? `bg-${colors[value]}-500` : 'bg-white/[0.06]'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

export default function Checkins() {
  const pendingClients = mockClients.filter(
    (c) => c.status === 'active' && !mockCheckins.some((ch) => ch.clientId === c.id && new Date(ch.date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
  )

  return (
    <Layout>
      <PageHeader title="Check-ins" subtitle={`${mockCheckins.length} completados esta semana`}>
        <Button icon={ClipboardCheck} size="sm">Cargar check-in</Button>
      </PageHeader>

      {/* Pending */}
      {pendingClients.length > 0 && (
        <div className="mb-6">
          <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Pendientes</h2>
          <div className="flex flex-col gap-2">
            {pendingClients.map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-4 bg-amber-500/5 border border-amber-500/15 rounded-xl hover:border-amber-500/25 transition-colors">
                <Clock size={16} className="text-amber-400 shrink-0" />
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-semibold shrink-0"
                  style={{ backgroundColor: c.avatarColor + '33', color: c.avatarColor }}
                >
                  {c.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium">{c.name}</div>
                  <div className="text-slate-500 text-xs">Último: {new Date(c.lastCheckin).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}</div>
                </div>
                <Button size="sm" variant="secondary">Cargar</Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed */}
      <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Completados esta semana</h2>
      <div className="flex flex-col gap-4">
        {mockCheckins.map((checkin) => {
          const client = mockClients.find((c) => c.id === checkin.clientId)
          const dec = decisionConfig[checkin.decision]
          const DecIcon = dec?.icon || Minus
          return (
            <div key={checkin.id} className="bg-[#111118] border border-white/[0.06] rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-white/[0.04]">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-semibold shrink-0"
                    style={{ backgroundColor: client?.avatarColor + '33', color: client?.avatarColor }}
                  >
                    {client?.avatar}
                  </div>
                  <div>
                    <div className="text-white font-semibold text-sm">{checkin.clientName}</div>
                    <div className="text-slate-500 text-xs">
                      Semana {checkin.week} · {new Date(checkin.date).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {checkin.photos && (
                    <span className="text-xs text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2.5 py-1 rounded-full">📸 Fotos</span>
                  )}
                  <Badge variant={checkin.decision}>
                    <DecIcon size={11} className="mr-1" />
                    {dec?.label}
                  </Badge>
                </div>
              </div>

              {/* Body */}
              <div className="p-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {/* Metrics */}
                <div>
                  <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-3">Bienestar</div>
                  <div className="flex flex-col gap-2.5">
                    <RatingBar value={checkin.energy} label="Energía" />
                    <RatingBar value={checkin.sleep} label="Sueño" />
                    <RatingBar value={checkin.stress} label="Estrés" />
                    <RatingBar value={checkin.hunger} label="Hambre" />
                  </div>
                </div>

                {/* Adherence */}
                <div>
                  <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-3">Adherencia</div>
                  <div className="flex flex-col gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-slate-400 text-xs">Nutrición</span>
                        <span className={`text-xs font-bold ${checkin.adherenceNutrition >= 85 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {checkin.adherenceNutrition}%
                        </span>
                      </div>
                      <ProgressBar value={checkin.adherenceNutrition} color={checkin.adherenceNutrition >= 85 ? 'emerald' : 'amber'} showValue={false} />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-slate-400 text-xs">Entrenamiento</span>
                        <span className={`text-xs font-bold ${checkin.adherenceTraining >= 85 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {checkin.adherenceTraining}%
                        </span>
                      </div>
                      <ProgressBar value={checkin.adherenceTraining} color={checkin.adherenceTraining >= 85 ? 'emerald' : 'amber'} showValue={false} />
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-white/[0.02] rounded-xl">
                      <span className="text-slate-500 text-xs">Peso</span>
                      <span className="text-white font-bold text-sm">{checkin.weight} kg</span>
                    </div>
                  </div>
                </div>

                {/* Comments */}
                <div>
                  <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-3">Comentarios</div>
                  <div className="flex flex-col gap-2.5">
                    <div className="p-3 bg-white/[0.02] rounded-xl">
                      <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1.5">
                        <MessageSquare size={11} /> Asesorado
                      </div>
                      <p className="text-slate-300 text-xs leading-relaxed">{checkin.clientComment}</p>
                    </div>
                    <div className="p-3 bg-accent/5 border border-accent/10 rounded-xl">
                      <div className="flex items-center gap-1.5 text-accent text-xs mb-1.5 font-medium">
                        <CheckCircle2 size={11} /> Coach
                      </div>
                      <p className="text-slate-300 text-xs leading-relaxed">{checkin.coachFeedback}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </Layout>
  )
}
