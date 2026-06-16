import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, User, Dumbbell, Utensils, TrendingUp,
  ClipboardCheck, Phone, Mail, AlertCircle, Calendar,
  Camera, ImageOff, Clock, MessageSquare, Loader2, Ruler,
} from 'lucide-react'
import Layout from '../components/layout/Layout'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import SectionCard from '../components/ui/SectionCard'
import ProgressBar from '../components/ui/ProgressBar'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { getClientById } from '../services/clientService'
import { getCompliance, getFoodLogs, getNutritionPlan } from '../services/nutritionService'
import { getWorkoutPlan } from '../services/workoutService'
import { getProgressMetrics } from '../services/progressService'
import { getCheckins } from '../services/checkinService'
import { getClientCheckinPhotos } from '../services/photoService'
import { useCheckinPhotoUrl } from '../lib/heicPhoto'
import { normalizeMealPlan } from '../lib/mealPlan'

const TABS = [
  { id: 'summary', label: 'Resumen', icon: User },
  { id: 'nutrition', label: 'Nutrición', icon: Utensils },
  { id: 'training', label: 'Entrenamiento', icon: Dumbbell },
  { id: 'checkins', label: 'Check-ins', icon: ClipboardCheck },
  { id: 'progress', label: 'Progreso', icon: TrendingUp },
]

const COMPLIANCE_BADGE = {
  cumplido: { label: 'Cumplió', cls: 'bg-emerald-500/10 text-emerald-400' },
  parcial: { label: 'Parcial', cls: 'bg-amber-500/10 text-amber-400' },
  no_cumplido: { label: 'No cumplió', cls: 'bg-rose-500/10 text-rose-400' },
}

const POSE_LABEL = { frente: 'Frente', perfil: 'Perfil', espalda: 'Espalda' }

const fmtDate = (iso, opts = { day: 'numeric', month: 'long' }) =>
  iso ? new Date(iso).toLocaleDateString('es-AR', opts) : null

// Placeholder uniforme para secciones sin datos cargados todavía.
function TabEmpty({ icon: Icon, text }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <Icon size={26} className="text-slate-500" strokeWidth={1.75} />
      <p className="text-sm text-slate-500">{text}</p>
    </div>
  )
}

// ── Coach: historial de cumplimiento del plan del asesorado ───────────────────
function CoachComplianceList({ clientId }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    getCompliance(clientId, 14)
      .then(({ data }) => { if (active) setRows(data ?? []) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [clientId])

  if (loading) return <div className="py-4 text-center text-sm text-slate-500">Cargando…</div>
  if (rows.length === 0) {
    return <div className="py-4 text-center text-sm text-slate-500">El asesorado todavía no registró cumplimiento.</div>
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => {
        const b = COMPLIANCE_BADGE[r.status] || { label: r.status, cls: 'bg-white/10 text-slate-400' }
        // Si hay ratio de comidas (FASE E), mostramos el % real del día.
        const hasRatio = r.meals_total != null && r.meals_total > 0
        const pct = hasRatio ? Math.round(Math.min(1, (r.meals_done ?? 0) / r.meals_total) * 100) : null
        return (
          <div key={r.id} className="flex items-start justify-between gap-3 p-3 bg-white/[0.02] rounded-xl">
            <div className="min-w-0">
              <div className="text-white text-sm font-medium">
                {r.log_date ? new Date(r.log_date + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }) : '—'}
              </div>
              {hasRatio && (
                <div className="text-slate-500 text-xs mt-0.5">
                  {r.meals_done ?? 0} de {r.meals_total} comidas marcadas
                </div>
              )}
              {r.note && <div className="text-slate-500 text-xs mt-0.5">{r.note}</div>}
            </div>
            <span className={`shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${b.cls}`}>
              {pct != null ? `${pct}%` : b.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Coach: comidas registradas por el asesorado ───────────────────────────────
function CoachFoodLogs({ clientId }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    getFoodLogs(clientId, 20)
      .then(({ data }) => { if (active) setRows(data ?? []) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [clientId])

  if (loading) return <div className="py-4 text-center text-sm text-slate-500">Cargando…</div>
  if (rows.length === 0) {
    return <div className="py-4 text-center text-sm text-slate-500">El asesorado todavía no registró comidas.</div>
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((log) => (
        <div key={log.id} className="flex flex-col gap-1 p-3 bg-white/[0.02] rounded-xl">
          <div className="flex flex-wrap items-center gap-2">
            {log.meal_label && (
              <span className="rounded-md bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                {log.meal_label}
              </span>
            )}
            <span className="text-white text-sm font-medium">{log.description}</span>
          </div>
          {log.logged_at && (
            <div className="flex items-center gap-1 text-[11px] text-slate-600">
              <Clock size={11} /> {new Date(log.logged_at).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// Miniatura de la galería del coach. useCheckinPhotoUrl resuelve también las
// fotos HEIC (iPhone) que el navegador no puede mostrar de forma nativa.
function CoachPhotoThumb({ photo }) {
  const { src, converting } = useCheckinPhotoUrl(photo)
  const poseLabel = POSE_LABEL[photo.pose]
  return (
    <a
      href={src || undefined}
      target="_blank"
      rel="noreferrer"
      className="group relative aspect-square overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]"
    >
      {src ? (
        <img src={src} alt={poseLabel || 'Foto de progreso'} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-slate-600">
          {converting ? <Loader2 size={20} className="animate-spin" /> : <ImageOff size={20} />}
        </div>
      )}
      {poseLabel && (
        <span className="absolute left-1.5 top-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
          {poseLabel}
        </span>
      )}
      {photo.created_at && (
        <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-medium text-white backdrop-blur-sm">
          {new Date(photo.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
        </span>
      )}
    </a>
  )
}

// ── Coach: galería de fotos de progreso (solo lectura) ────────────────────────
function CoachPhotoGallery({ clientId }) {
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    getClientCheckinPhotos(clientId)
      .then(({ data }) => { if (active) setPhotos(data ?? []) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [clientId])

  if (loading) return <div className="py-4 text-center text-sm text-slate-500">Cargando fotos…</div>
  if (photos.length === 0) {
    return <div className="py-4 text-center text-sm text-slate-500">El asesorado todavía no subió fotos de progreso.</div>
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {photos.map((p) => <CoachPhotoThumb key={p.id} photo={p} />)}
    </div>
  )
}

// ── Tab Nutrición: plan real + registro del asesorado ─────────────────────────
function NutritionTab({ clientId }) {
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    getNutritionPlan(clientId)
      .then(({ data }) => { if (active) setPlan(data ?? null) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [clientId])

  const mealPlan = plan ? normalizeMealPlan(plan) : null

  return (
    <div className="flex flex-col gap-4">
      {loading ? (
        <SectionCard title="Plan nutricional">
          <div className="py-4 text-center text-sm text-slate-500">Cargando plan…</div>
        </SectionCard>
      ) : !plan ? (
        <SectionCard title="Plan nutricional">
          <TabEmpty icon={Utensils} text="Este asesorado todavía no tiene un plan nutricional activo." />
        </SectionCard>
      ) : (
        <div className="grid lg:grid-cols-3 gap-4">
          <SectionCard
            title="Objetivo calórico"
            subtitle={plan.lastUpdate ? `Actualizado ${fmtDate(plan.lastUpdate)}` : undefined}
            className="lg:col-span-1"
          >
            <div className="text-center py-2">
              <div className="text-4xl font-bold text-white mb-1">{plan.calories ?? '—'}</div>
              <div className="text-slate-500 text-sm">kcal / día</div>
            </div>
            <div className="flex flex-col gap-3 mt-4">
              {[
                { label: 'Proteína', value: plan.protein, max: 250, color: 'accent' },
                { label: 'Carbohidratos', value: plan.carbs, max: 400, color: 'sky' },
                { label: 'Grasas', value: plan.fat, max: 120, color: 'amber' },
              ].map((m) => m.value != null ? (
                <ProgressBar key={m.label} label={`${m.label} ${m.value}g`} value={m.value} max={m.max} color={m.color} />
              ) : (
                <div key={m.label} className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">{m.label}</span>
                  <span className="text-slate-600">Sin cargar</span>
                </div>
              ))}
            </div>
            {plan.notes && (
              <p className="mt-4 rounded-xl bg-white/[0.02] p-3 text-xs leading-relaxed text-slate-400 whitespace-pre-line">
                {plan.notes.length > 400 ? plan.notes.slice(0, 400) + '…' : plan.notes}
              </p>
            )}
          </SectionCard>

          <SectionCard title="Plan de comidas" className="lg:col-span-2">
            {mealPlan.type === 'empty' && (
              <TabEmpty icon={Utensils} text="El detalle de comidas todavía no está cargado." />
            )}
            {mealPlan.type === 'plain' && (
              <div className="whitespace-pre-line rounded-xl bg-white/[0.02] p-4 text-sm leading-relaxed text-slate-300">
                {mealPlan.text}
              </div>
            )}
            {(mealPlan.type === 'grouped' || mealPlan.type === 'daily') && (
              <div className="flex flex-col gap-3">
                {mealPlan.schemes.map((scheme, si) => (
                  <div key={si} className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
                    {scheme.scheme && (
                      <div className="mb-2 text-sm font-semibold text-accent">{scheme.scheme}</div>
                    )}
                    <div className="flex flex-col gap-2">
                      {scheme.meals.map((meal, mi) => (
                        <div key={mi} className="border-b border-white/[0.04] pb-2 last:border-0 last:pb-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-white">{meal.name}</span>
                            <span className="text-xs text-slate-500">
                              {meal.options.length} {meal.options.length === 1 ? 'opción' : 'opciones'}
                            </span>
                          </div>
                          <div className="mt-1 text-xs leading-relaxed text-slate-500">
                            {meal.options.map((o) => o.title).filter(Boolean).join(' · ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* Registro del asesorado: cumplimiento del plan + comidas */}
      <div className="grid lg:grid-cols-2 gap-4">
        <SectionCard title="Cumplimiento del plan" subtitle="Últimos 14 días">
          <CoachComplianceList clientId={clientId} />
        </SectionCard>
        <SectionCard title="Comidas registradas" subtitle="Lo que cargó el asesorado">
          <CoachFoodLogs clientId={clientId} />
        </SectionCard>
      </div>
    </div>
  )
}

// ── Tab Entrenamiento: rutina real (días con ejercicios anidados) ─────────────
function TrainingTab({ clientId }) {
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    getWorkoutPlan(clientId)
      .then(({ data }) => { if (active) setPlan(data ?? null) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [clientId])

  if (loading) {
    return (
      <SectionCard title="Rutina">
        <div className="py-4 text-center text-sm text-slate-500">Cargando rutina…</div>
      </SectionCard>
    )
  }

  if (!plan) {
    return (
      <SectionCard title="Rutina">
        <TabEmpty icon={Dumbbell} text="Este asesorado todavía no tiene una rutina activa." />
      </SectionCard>
    )
  }

  // En datos reales los ejercicios viven anidados en days[].exercises;
  // la columna exercises de nivel plan suele venir vacía.
  const days = Array.isArray(plan.days) ? plan.days : []

  return (
    <div className="flex flex-col gap-4">
      <SectionCard title="Plan activo" subtitle={days.length > 0 ? `${days.length} días por semana` : undefined}>
        <div className="p-3 bg-accent/10 border border-accent/20 rounded-xl">
          <div className="text-accent font-semibold text-sm">{plan.plan || 'Rutina sin título'}</div>
          {plan.notes && <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{plan.notes}</p>}
        </div>
      </SectionCard>

      {days.length === 0 ? (
        <SectionCard title="Días de entrenamiento">
          <TabEmpty icon={Dumbbell} text="La rutina no tiene días cargados todavía." />
        </SectionCard>
      ) : (
        days.map((day, di) => (
          <SectionCard
            key={di}
            title={day.focus || `Día ${di + 1}`}
            subtitle={day.day}
            action={
              <span className="text-xs text-slate-500">
                {(day.exercises?.length ?? 0)} ejercicios
              </span>
            }
          >
            {(day.exercises?.length ?? 0) === 0 ? (
              <p className="text-xs text-slate-600 py-2">Sin ejercicios cargados para este día.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {day.exercises.map((ex, i) => (
                  <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 bg-white/[0.02] rounded-xl">
                    <div className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center text-slate-500 shrink-0 font-semibold text-[10px]">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-medium">{ex.name}</div>
                      {ex.notes && <div className="text-slate-500 text-xs mt-0.5">{ex.notes}</div>}
                    </div>
                    <div className="flex gap-3 shrink-0 text-right">
                      {ex.sets && <span className="text-xs text-slate-300">{ex.sets} series</span>}
                      {ex.reps != null && ex.reps !== '' && <span className="text-xs text-slate-300">{ex.reps} reps</span>}
                      {ex.rir != null && ex.rir !== '' && <span className="text-xs text-slate-500">RIR {ex.rir}</span>}
                      {ex.rest && <span className="text-xs text-slate-500">desc. {ex.rest}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        ))
      )}
    </div>
  )
}

// ── Tab Check-ins: historial real + fotos ─────────────────────────────────────
function CheckinsTab({ clientId }) {
  const [checkins, setCheckins] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    getCheckins(clientId, 10)
      .then(({ data }) => { if (active) setCheckins(Array.isArray(data) ? data : []) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [clientId])

  return (
    <div className="flex flex-col gap-4">
      <SectionCard title="Historial de check-ins" subtitle="Más reciente primero">
        {loading ? (
          <div className="py-4 text-center text-sm text-slate-500">Cargando…</div>
        ) : checkins.length === 0 ? (
          <TabEmpty icon={ClipboardCheck} text="Todavía no hay check-ins registrados para este asesorado." />
        ) : (
          <div className="flex flex-col gap-2">
            {checkins.map((c) => (
              <div key={c.id} className="flex flex-col gap-2 p-3.5 bg-white/[0.02] rounded-xl">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-white text-sm font-medium">{fmtDate(c.date, { day: 'numeric', month: 'long', year: 'numeric' }) || 'Check-in'}</span>
                  {c.decision && <Badge variant={c.decision} />}
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                  {c.weight != null && <span>Peso: <strong className="text-slate-300">{c.weight} kg</strong></span>}
                  {c.nutritionAdherence != null && <span>Nutrición: <strong className="text-slate-300">{c.nutritionAdherence}%</strong></span>}
                  {c.trainingAdherence != null && <span>Entreno: <strong className="text-slate-300">{c.trainingAdherence}%</strong></span>}
                </div>
                {c.clientComment && (
                  <p className="text-xs leading-relaxed text-slate-400">
                    <MessageSquare size={11} className="mr-1 inline text-slate-500" />
                    {c.clientComment}
                  </p>
                )}
                {c.coachFeedback && (
                  <p className="rounded-lg bg-accent/[0.06] border border-accent/10 p-2.5 text-xs leading-relaxed text-slate-300">
                    {c.coachFeedback}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Fotos de progreso" subtitle="Subidas por el asesorado" action={<Camera size={16} className="text-slate-500" />}>
        <CoachPhotoGallery clientId={clientId} />
      </SectionCard>
    </div>
  )
}

// ── Tab Progreso: métricas reales ─────────────────────────────────────────────
function ProgressTab({ client }) {
  const [progress, setProgress] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    getProgressMetrics(client.id)
      .then(({ data }) => { if (active) setProgress(data ?? null) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [client.id])

  if (loading) {
    return (
      <SectionCard title="Progreso">
        <div className="py-4 text-center text-sm text-slate-500">Cargando métricas…</div>
      </SectionCard>
    )
  }

  const history = progress?.weightHistory ?? []
  const measurements = progress?.measurements ?? {}
  const measureItems = [
    { label: 'Cintura', value: measurements.waist },
    { label: 'Pecho', value: measurements.chest },
    { label: 'Cadera', value: measurements.hip },
    { label: 'Brazo', value: measurements.arm },
    { label: 'Pierna', value: measurements.leg },
  ].filter((m) => m.value != null)
  // Historial de mediciones del más reciente al más antiguo.
  const measurePoints = [...(progress?.measurementPoints ?? [])].reverse()

  if (history.length === 0 && measureItems.length === 0) {
    return (
      <SectionCard title="Progreso">
        <TabEmpty icon={TrendingUp} text="Todavía no hay métricas de progreso. Cuando el asesorado cargue su peso, vas a verlo acá." />
      </SectionCard>
    )
  }

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      {history.length > 0 && (
        <SectionCard title="Evolución de peso" subtitle={`${progress.count} registros`}>
          <div className="flex items-end gap-1 h-32 mt-2">
            {history.map((w, i) => {
              const max = Math.max(...history)
              const min = Math.min(...history)
              const range = max - min || 1
              const heightPct = ((w - min) / range) * 80 + 20
              const isLast = i === history.length - 1
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  <span className="text-slate-500 text-[9px]">{w}</span>
                  <div
                    className={`w-full rounded-t-sm transition-colors ${isLast ? 'bg-accent' : 'bg-accent/60 hover:bg-accent'}`}
                    style={{ height: `${heightPct}%` }}
                  />
                  <span className="text-slate-600 text-[9px] truncate w-full text-center">{progress.dates?.[i]}</span>
                </div>
              )
            })}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-white/[0.05]">
            <span>Inicio: <span className="text-white font-semibold">{history[0]} kg</span></span>
            <span>Actual: <span className="text-emerald-400 font-semibold">{history[history.length - 1]} kg</span></span>
            {client.targetWeight != null && (
              <span>Objetivo: <span className="text-accent font-semibold">{client.targetWeight} kg</span></span>
            )}
          </div>
        </SectionCard>
      )}

      {measureItems.length > 0 && (
        <SectionCard title="Medidas corporales" subtitle="Último registro">
          <div className="flex flex-col gap-3">
            {measureItems.map((m) => (
              <div key={m.label} className="flex items-center justify-between p-3 bg-white/[0.02] rounded-xl">
                <span className="text-slate-400 text-sm">{m.label}</span>
                <span className="text-white font-bold">{m.value} cm</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {measurePoints.length > 0 && (
        <SectionCard
          title="Historial de mediciones"
          subtitle="Más reciente primero"
          action={<Ruler size={16} className="text-slate-500" />}
          className="lg:col-span-2"
        >
          <div className="flex flex-col gap-2">
            {measurePoints.map((p) => (
              <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 p-3 bg-white/[0.02] rounded-xl">
                <span className="text-sm text-slate-400">
                  {fmtDate(p.iso, { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                <div className="flex flex-wrap gap-3 text-xs">
                  {[
                    ['Cintura', p.waist],
                    ['Pecho', p.chest],
                    ['Cadera', p.hip],
                    ['Brazo', p.arm],
                    ['Pierna', p.leg],
                  ]
                    .filter(([, v]) => v != null)
                    .map(([label, v]) => (
                      <span key={label} className="text-slate-500">
                        {label}: <strong className="text-slate-200">{v} cm</strong>
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  )
}

export default function ClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [client, setClient]     = useState(null)
  const [loading, setLoading]   = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activeTab, setActiveTab] = useState('summary')

  useEffect(() => {
    if (!id) return
    let active = true
    getClientById(id)
      .then(({ data, error }) => {
        if (!active) return
        if (error || !data) setNotFound(true)
        else setClient(data)
      })
      .catch(() => { if (active) setNotFound(true) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id])

  if (loading) {
    return (
      <Layout>
        <PageLoader label="Cargando asesorado..." />
      </Layout>
    )
  }

  if (notFound || !client) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <AlertCircle size={40} className="text-slate-500" />
          <p className="text-slate-400">Asesorado no encontrado.</p>
          <Button onClick={() => navigate('/clients')} icon={ArrowLeft}>
            Volver
          </Button>
        </div>
      </Layout>
    )
  }

  const heroMeta = [client.objective, client.age ? `${client.age} años` : null, client.experience]
    .filter(Boolean).join(' · ')

  return (
    <Layout>
      {/* Back */}
      <button
        onClick={() => navigate('/clients')}
        className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-5 transition-colors"
      >
        <ArrowLeft size={16} /> Volver a asesorados
      </button>

      {/* Hero card */}
      <div className="bg-[#111118] border border-white/[0.06] rounded-2xl p-6 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold shrink-0"
            style={{ backgroundColor: (client.avatarColor || '#6c63ff') + '22', color: client.avatarColor || '#8b85ff' }}
          >
            {client.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-white">{client.name}</h1>
              <Badge variant={client.status} />
            </div>
            {heroMeta && <p className="text-slate-400 text-sm">{heroMeta}</p>}
            <div className="flex flex-wrap gap-4 mt-3">
              {client.email && (
                <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                  <Mail size={12} /> {client.email}
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                  <Phone size={12} /> {client.phone}
                </div>
              )}
              {client.startDate && (
                <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                  <Calendar size={12} /> Desde {fmtDate(client.startDate, { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-white/[0.05]">
          <div>
            <div className="text-slate-500 text-xs mb-1">Peso actual</div>
            <div className="text-white font-bold text-lg">{client.weight != null ? `${client.weight} kg` : '—'}</div>
          </div>
          <div>
            <div className="text-slate-500 text-xs mb-1">Objetivo</div>
            <div className="text-white font-bold text-lg">{client.targetWeight != null ? `${client.targetWeight} kg` : '—'}</div>
          </div>
          <div>
            <div className="text-slate-500 text-xs mb-1">Adherencia nut.</div>
            <div className="text-emerald-400 font-bold text-lg">{client.adherenceNutrition != null ? `${client.adherenceNutrition}%` : '—'}</div>
          </div>
          <div>
            <div className="text-slate-500 text-xs mb-1">Adherencia ent.</div>
            <div className="text-emerald-400 font-bold text-lg">{client.adherenceTraining != null ? `${client.adherenceTraining}%` : '—'}</div>
            {client.weeklyTraining?.planned > 0 && (
              <div className="text-slate-500 text-[11px] mt-0.5">
                {client.weeklyTraining.done}/{client.weeklyTraining.planned} esta semana
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 mb-4">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === id
                ? 'bg-accent/15 text-accent border border-accent/25'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'summary' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <SectionCard title="Datos personales">
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Altura', client.height != null ? `${client.height} cm` : '—'],
                ['Peso', client.weight != null ? `${client.weight} kg` : '—'],
                ['Objetivo de peso', client.targetWeight != null ? `${client.targetWeight} kg` : '—'],
                ['Experiencia', client.experience || '—'],
                ['Días disponibles', client.availableDays?.length || '—'],
              ].map(([label, val]) => (
                <div key={label}>
                  <div className="text-slate-500 text-xs mb-0.5">{label}</div>
                  <div className="text-white text-sm font-medium">{val}</div>
                </div>
              ))}
            </div>
            {client.limitations && (
              <div className="mt-4 p-3 bg-amber-500/5 border border-amber-500/15 rounded-xl">
                <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold mb-1">
                  <AlertCircle size={13} /> Limitaciones
                </div>
                <p className="text-slate-300 text-sm">{client.limitations}</p>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Días disponibles">
            <div className="flex flex-wrap gap-2">
              {['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'].map((day) => (
                <span
                  key={day}
                  className={`px-3 py-1.5 rounded-xl text-sm ${
                    client.availableDays?.includes(day)
                      ? 'bg-accent/15 text-accent border border-accent/25'
                      : 'bg-white/[0.03] text-slate-600 border border-white/[0.04]'
                  }`}
                >
                  {day}
                </span>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Adherencia semanal">
            <div className="flex flex-col gap-4">
              <ProgressBar label="Nutrición" value={client.adherenceNutrition ?? 0} color="accent" />
              <ProgressBar label="Entrenamiento" value={client.adherenceTraining ?? 0} color="emerald" />
            </div>
          </SectionCard>

          <SectionCard title="Notas internas">
            <p className="text-slate-300 text-sm leading-relaxed">
              {client.internalNotes || 'Sin notas internas todavía.'}
            </p>
            <div className="mt-4 flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Último check-in</span>
                <span className="text-white">{fmtDate(client.lastCheckin) || 'Sin registro'}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Próxima revisión</span>
                <span className="text-white">{fmtDate(client.nextReview) || 'Sin programar'}</span>
              </div>
              {client.weeklyGoal && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Objetivo semanal</span>
                  <span className="text-accent">{client.weeklyGoal}</span>
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === 'nutrition' && <NutritionTab clientId={client.id} />}
      {activeTab === 'training' && <TrainingTab clientId={client.id} />}
      {activeTab === 'checkins' && <CheckinsTab clientId={client.id} />}
      {activeTab === 'progress' && <ProgressTab client={client} />}
    </Layout>
  )
}
