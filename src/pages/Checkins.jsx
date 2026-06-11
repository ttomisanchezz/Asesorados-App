import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, ClipboardCheck, MessageSquare, CheckCircle2 } from 'lucide-react'
import Layout from '../components/layout/Layout'
import PageHeader from '../components/ui/PageHeader'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import ProgressBar from '../components/ui/ProgressBar'
import EmptyState from '../components/ui/EmptyState'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { getClients } from '../services/clientService'
import { getAllRecentCheckins } from '../services/checkinService'

const RATINGS = {
  1: { label: 'Muy bajo', text: 'text-rose-400', bar: 'bg-rose-500' },
  2: { label: 'Bajo', text: 'text-orange-400', bar: 'bg-orange-500' },
  3: { label: 'Regular', text: 'text-amber-400', bar: 'bg-amber-500' },
  4: { label: 'Bueno', text: 'text-emerald-400', bar: 'bg-emerald-500' },
  5: { label: 'Excelente', text: 'text-emerald-400', bar: 'bg-emerald-500' },
}

function RatingBar({ value, label }) {
  if (value == null) return null
  const cfg = RATINGS[value]
  if (!cfg) return null
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-slate-500 text-xs">{label}</span>
        <span className={`text-xs font-semibold ${cfg.text}`}>{cfg.label}</span>
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`flex-1 h-1.5 rounded-full ${i <= value ? cfg.bar : 'bg-white/[0.06]'}`}
          />
        ))}
      </div>
    </div>
  )
}

const fmtLong = (iso) =>
  iso ? new Date(iso).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }) : null

export default function Checkins() {
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [checkins, setCheckins] = useState([])
  // Timestamp capturado al cargar (evita llamar Date.now() durante el render).
  const [loadedAt, setLoadedAt] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    Promise.allSettled([getClients(), getAllRecentCheckins(20)])
      .then(([cls, chk]) => {
        if (!active) return
        setClients(cls.status === 'fulfilled' && Array.isArray(cls.value.data) ? cls.value.data : [])
        setCheckins(chk.status === 'fulfilled' && Array.isArray(chk.value.data) ? chk.value.data : [])
        setLoadedAt(Date.now())
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  if (loading) {
    return (
      <Layout>
        <PageLoader label="Cargando check-ins..." />
      </Layout>
    )
  }

  // Pendientes: activos sin check-in en los últimos 7 días.
  const weekAgo = (loadedAt ?? 0) - 7 * 24 * 60 * 60 * 1000
  const recentByClient = new Set(
    checkins
      .filter((c) => c.created_at && new Date(c.created_at).getTime() > weekAgo)
      .map((c) => c.client_id),
  )
  const pendingClients = clients.filter(
    (c) => c.status === 'active' && !recentByClient.has(c.id),
  )
  const weekCount = checkins.filter(
    (c) => c.created_at && new Date(c.created_at).getTime() > weekAgo,
  ).length

  return (
    <Layout>
      <PageHeader
        title="Check-ins"
        subtitle={`${weekCount} ${weekCount === 1 ? 'completado' : 'completados'} en los últimos 7 días`}
      />

      {/* Pending */}
      {pendingClients.length > 0 && (
        <div className="mb-6">
          <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Pendientes esta semana</h2>
          <div className="flex flex-col gap-2">
            {pendingClients.map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-4 bg-amber-500/5 border border-amber-500/15 rounded-xl hover:border-amber-500/25 transition-colors">
                <Clock size={16} className="text-amber-400 shrink-0" />
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-semibold shrink-0"
                  style={{ backgroundColor: (c.avatarColor || '#6c63ff') + '33', color: c.avatarColor || '#8b85ff' }}
                >
                  {c.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium">{c.name}</div>
                  <div className="text-slate-500 text-xs">
                    {c.lastCheckin
                      ? `Último: ${new Date(c.lastCheckin).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}`
                      : 'Sin check-ins todavía'}
                  </div>
                </div>
                <Button size="sm" variant="secondary" onClick={() => navigate(`/clients/${c.id}`)}>
                  Ver ficha
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed */}
      <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Recientes</h2>
      {checkins.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Todavía no hay check-ins registrados"
          description="Cuando tus asesorados registren check-ins, vas a verlos acá con su bienestar, adherencia y comentarios."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {checkins.map((checkin) => {
            const clientName = checkin.clients?.full_name || 'Asesorado'
            const avatarColor = checkin.clients?.avatar_color || '#6c63ff'
            const avatar = checkin.clients?.avatar_initials
              || clientName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
            const ratings = [
              { label: 'Energía', value: checkin.energy },
              { label: 'Sueño', value: checkin.sleep },
              { label: 'Estrés', value: checkin.stress },
              { label: 'Hambre', value: checkin.hunger },
            ].filter((r) => r.value != null)

            return (
              <div key={checkin.id} className="bg-[#111118] border border-white/[0.06] rounded-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-white/[0.04]">
                  <div
                    className="flex items-center gap-3 cursor-pointer min-w-0"
                    onClick={() => navigate(`/clients/${checkin.client_id}`)}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-semibold shrink-0"
                      style={{ backgroundColor: avatarColor + '33', color: avatarColor }}
                    >
                      {avatar}
                    </div>
                    <div className="min-w-0">
                      <div className="text-white font-semibold text-sm truncate">{clientName}</div>
                      <div className="text-slate-500 text-xs capitalize">{fmtLong(checkin.created_at)}</div>
                    </div>
                  </div>
                  {checkin.decision && <Badge variant={checkin.decision} />}
                </div>

                {/* Body */}
                <div className="p-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {/* Bienestar */}
                  <div>
                    <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-3">Bienestar</div>
                    {ratings.length === 0 ? (
                      <p className="text-xs text-slate-600">Sin datos de bienestar.</p>
                    ) : (
                      <div className="flex flex-col gap-2.5">
                        {ratings.map((r) => <RatingBar key={r.label} value={r.value} label={r.label} />)}
                      </div>
                    )}
                  </div>

                  {/* Adherencia */}
                  <div>
                    <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-3">Adherencia</div>
                    <div className="flex flex-col gap-3">
                      {checkin.nutrition_adherence != null && (
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-slate-400 text-xs">Nutrición</span>
                            <span className={`text-xs font-bold ${checkin.nutrition_adherence >= 85 ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {checkin.nutrition_adherence}%
                            </span>
                          </div>
                          <ProgressBar value={checkin.nutrition_adherence} color={checkin.nutrition_adherence >= 85 ? 'emerald' : 'amber'} showValue={false} />
                        </div>
                      )}
                      {checkin.training_adherence != null && (
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-slate-400 text-xs">Entrenamiento</span>
                            <span className={`text-xs font-bold ${checkin.training_adherence >= 85 ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {checkin.training_adherence}%
                            </span>
                          </div>
                          <ProgressBar value={checkin.training_adherence} color={checkin.training_adherence >= 85 ? 'emerald' : 'amber'} showValue={false} />
                        </div>
                      )}
                      {checkin.weight != null && (
                        <div className="flex items-center justify-between p-2.5 bg-white/[0.02] rounded-xl">
                          <span className="text-slate-500 text-xs">Peso</span>
                          <span className="text-white font-bold text-sm">{checkin.weight} kg</span>
                        </div>
                      )}
                      {checkin.nutrition_adherence == null && checkin.training_adherence == null && checkin.weight == null && (
                        <p className="text-xs text-slate-600">Sin datos de adherencia.</p>
                      )}
                    </div>
                  </div>

                  {/* Comentarios */}
                  <div>
                    <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-3">Comentarios</div>
                    <div className="flex flex-col gap-2.5">
                      {checkin.client_comment ? (
                        <div className="p-3 bg-white/[0.02] rounded-xl">
                          <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1.5">
                            <MessageSquare size={11} /> Asesorado
                          </div>
                          <p className="text-slate-300 text-xs leading-relaxed">{checkin.client_comment}</p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-600">Sin comentario del asesorado.</p>
                      )}
                      {checkin.coach_feedback && (
                        <div className="p-3 bg-accent/5 border border-accent/10 rounded-xl">
                          <div className="flex items-center gap-1.5 text-accent text-xs mb-1.5 font-medium">
                            <CheckCircle2 size={11} /> Coach
                          </div>
                          <p className="text-slate-300 text-xs leading-relaxed">{checkin.coach_feedback}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Layout>
  )
}
