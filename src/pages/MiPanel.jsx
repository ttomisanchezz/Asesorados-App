import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Utensils, Dumbbell, ClipboardCheck, TrendingUp, ArrowRight, Scale, Target,
  CheckCircle2, Clock, AlertCircle, MessageSquare, Zap, ChevronRight, LogOut, Sparkles,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import SectionCard from '../components/ui/SectionCard'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { PanelEmpty } from '../components/panel/PanelUI'
import { getMyClientProfile } from '../services/clientService'
import { getMyNutritionPlan } from '../services/nutritionService'
import { getMyWorkoutPlan } from '../services/workoutService'
import { getMyProgress } from '../services/progressService'
import { getMyCheckins } from '../services/checkinService'
import { getMyWeeklyTrainingCount } from '../services/workoutLogService'

// Inicio de la semana actual (lunes 00:00 hora local).
function startOfWeek(d = new Date()) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)) // 0 = lunes
  return x
}

const fmtShortDate = (iso) =>
  new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })

// Macro cargado → "90g"; sin cargar (null) → "— g" en gris. Nunca inventa valores.
const hasMacro = (v) => v !== null && v !== undefined && v !== ''
const macroValue = (v, unit = 'g') => (hasMacro(v) ? `${v}${unit}` : `— ${unit}`.trim())
const macroClass = (v) => `mt-0.5 font-semibold ${hasMacro(v) ? 'text-white' : 'text-slate-500'}`

// ── Header del panel ─────────────────────────────────────────────────────────
// Declarado a nivel de módulo (no dentro del render) para no recrear el
// componente en cada render y conservar el estado de sus hijos.
function PanelHeader({ onSignOut }) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-surface-900/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent shadow-glow">
            <Zap size={14} className="text-white" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-white">Mi seguimiento</span>
        </div>
        <button
          onClick={onSignOut}
          aria-label="Cerrar sesión"
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-slate-500 transition-colors hover:bg-white/[0.04] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <LogOut size={13} />
          Salir
        </button>
      </div>
    </header>
  )
}

// ── Card de métrica con diferenciación dato real / sin dato ──────────────────
function MetricCard({ icon: Icon, label, value, unit, hint, emptyHint, valueClass = 'text-white' }) {
  const hasValue = value !== null && value !== undefined && value !== ''
  // Detectar si el value es numérico (número JS o string que solo contiene dígitos/punto/coma/signo)
  const isNumeric = typeof value === 'number' || /^[\d.,-]+$/.test(String(value ?? ''))
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-surface-800 p-4 transition-colors hover:border-white/[0.1]">
      <div className="mb-3 flex items-center gap-2">
        <Icon size={14} className="text-slate-500" strokeWidth={1.75} />
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      {hasValue ? (
        isNumeric ? (
          <div className={`text-2xl font-bold leading-none ${valueClass}`}>
            {value}
            {unit && <span className="ml-1 text-sm font-medium text-slate-500">{unit}</span>}
          </div>
        ) : (
          <div className={`text-base font-semibold leading-snug ${valueClass}`}>
            {value}
          </div>
        )
      ) : (
        <div className="text-base font-semibold text-slate-600">Sin registro</div>
      )}
      <div className="mt-1.5 text-[11px] leading-snug text-slate-600">
        {hasValue ? hint : emptyHint}
      </div>
    </div>
  )
}

// ── Fila del resumen semanal ─────────────────────────────────────────────────
function SummaryRow({ icon: Icon, label, value, sub, empty }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/[0.04] py-3 last:border-0">
      <div className="flex min-w-0 items-center gap-2.5">
        <Icon size={15} className="shrink-0 text-slate-500" strokeWidth={1.75} />
        <span className="text-sm text-slate-400">{label}</span>
      </div>
      <div className="text-right">
        <div className={`text-sm font-semibold ${empty ? 'text-slate-600' : 'text-white'}`}>{value}</div>
        {sub && <div className="mt-0.5 text-[11px] text-slate-600">{sub}</div>}
      </div>
    </div>
  )
}

export default function MiPanel() {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const [client, setClient] = useState(null)
  const [nutrition, setNutrition] = useState(null)
  const [training, setTraining] = useState(null)
  const [progress, setProgress] = useState(null)
  const [checkins, setCheckins] = useState([])
  const [weeklyTrainings, setWeeklyTrainings] = useState(0)
  const [loading, setLoading] = useState(true)

  async function handleSignOut() {
    await signOut()
    navigate('/', { replace: true })
  }

  useEffect(() => {
    // Perfil + planes + progreso + check-ins en paralelo, con los services
    // existentes (cada uno resuelve client_id desde auth.uid() y respeta demo).
    // allSettled aísla fallos: un fetch que falle no deja en blanco el panel.
    const weekStartIso = startOfWeek().toISOString()
    Promise.allSettled([
      getMyClientProfile(),
      getMyNutritionPlan(),
      getMyWorkoutPlan(),
      getMyProgress(),
      getMyCheckins(),
      getMyWeeklyTrainingCount(weekStartIso),
    ])
      .then(([profile, nutri, workout, prog, checks, weeklyTrain]) => {
        setClient(profile.status === 'fulfilled' ? (profile.value?.data ?? null) : null)
        setNutrition(nutri.status === 'fulfilled' ? (nutri.value?.data ?? null) : null)
        setTraining(workout.status === 'fulfilled' ? (workout.value?.data ?? null) : null)
        setProgress(prog.status === 'fulfilled' ? (prog.value?.data ?? null) : null)
        setCheckins(checks.status === 'fulfilled' && Array.isArray(checks.value?.data) ? checks.value.data : [])
        setWeeklyTrainings(weeklyTrain.status === 'fulfilled' ? (weeklyTrain.value?.count ?? 0) : 0)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-surface-900">
        <PanelHeader onSignOut={handleSignOut} />
        <PageLoader label="Cargando tu panel..." />
      </div>
    )
  }

  if (!client) {
    return (
      <div className="min-h-[100dvh] bg-surface-900">
        <PanelHeader onSignOut={handleSignOut} />
        <PanelEmpty
          icon={Sparkles}
          tone="accent"
          title="No encontramos tu seguimiento activo"
          description="Tu cuenta ya está creada, pero todavía no tiene un plan asignado. Pedile a tu coach que revise la configuración."
        />
      </div>
    )
  }

  // ── Datos derivados (sin inventar) ─────────────────────────────────────────
  const firstName = client.name?.trim().split(' ')[0]
  // Guard defensivo: checkins reales (array) o vacío. Nunca depende de mocks.
  const safeCheckins = Array.isArray(checkins) ? checkins : []
  const lastCheckin = safeCheckins[0] ?? null
  const nextCheckinDate = client.nextReview ? new Date(client.nextReview) : null
  const daysUntilCheckin = nextCheckinDate
    ? Math.ceil((nextCheckinDate - new Date()) / (1000 * 60 * 60 * 24))
    : null

  // ── Datos reales de la semana actual (sin denormalizar, sin mock) ──────────
  const weekStart = startOfWeek()

  // Peso actual = último punto real de progress_metrics; fallback a la ficha.
  const progressPoints = progress?.points ?? []
  const lastPoint = progressPoints.length ? progressPoints[progressPoints.length - 1] : null
  const currentWeight = lastPoint?.weight ?? client.weight ?? null
  const currentWeightDate = lastPoint?.iso ?? null

  // Adherencia nutricional = check-in de esta semana con dato de adherencia.
  const weekCheckins = safeCheckins.filter((c) => c.date && new Date(c.date) >= weekStart)
  const weekNutriCheckin = weekCheckins.find((c) => c.nutritionAdherence != null) ?? null
  const nutritionAdh = weekNutriCheckin?.nutritionAdherence ?? null

  // Adherencia entrenamiento = workout_sessions de la semana vs días del plan.
  const planDays = training?.days?.length ?? 0
  const trainingsDone = weeklyTrainings
  const trainingValue = trainingsDone > 0
    ? (planDays > 0 ? `${trainingsDone}/${planDays}` : `${trainingsDone}`)
    : null

  // ¿Hay algo real que resumir esta semana?
  const hasWeeklyData =
    currentWeight != null || trainingsDone > 0 || weekCheckins.length > 0
  // "Falta info" cuando no hay ni peso ni actividad de la semana.
  const dataPending = currentWeight == null && !hasWeeklyData

  const today = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="min-h-[100dvh] bg-surface-900 pb-12">
      <PanelHeader onSignOut={handleSignOut} />

      {/* Halo sutil de acento detrás del encabezado */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(ellipse_at_top,rgba(108,99,255,0.10),transparent_70%)]" />

        <div className="relative mx-auto flex max-w-2xl flex-col gap-6 px-4 pt-7">

          {/* Saludo + avatar */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                {firstName ? `Hola, ${firstName}` : 'Hola'}
              </h1>
              <p className="mt-1 text-sm capitalize text-slate-500">
                {today}
                {lastCheckin?.week && (
                  <span className="lowercase"> · semana {lastCheckin.week}</span>
                )}
              </p>
            </div>
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-bold ring-1 ring-white/[0.08]"
              style={{ backgroundColor: (client.avatarColor || '#6c63ff') + '22', color: client.avatarColor || '#8b85ff' }}
            >
              {client.avatar}
            </div>
          </div>

          {/* Hero / resumen breve */}
          <p className="text-sm leading-relaxed text-slate-400">
            Este es tu espacio para revisar tu nutrición, entrenamiento y progreso.
            {dataPending && (
              <span className="mt-1 block text-slate-500">
                Todavía hay información pendiente de cargar para completar tu seguimiento.
              </span>
            )}
          </p>

          {/* Métricas principales */}
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              icon={Scale}
              label="Peso actual"
              value={currentWeight}
              unit="kg"
              hint={currentWeightDate ? `Último registro · ${fmtShortDate(currentWeightDate)}` : 'Último registro cargado'}
              emptyHint="Cargá tu peso en Mi progreso"
            />
            <MetricCard
              icon={Target}
              label="Objetivo"
              value={client.objective || null}
              valueClass="text-accent-light"
              hint="Objetivo del plan"
              emptyHint="Sin objetivo definido"
            />
            <MetricCard
              icon={Utensils}
              label="Adherencia nutricional"
              value={nutritionAdh}
              unit="%"
              valueClass={nutritionAdh >= 85 ? 'text-emerald-400' : 'text-amber-400'}
              hint="Check-in de esta semana"
              emptyHint="Sin check-in esta semana"
            />
            <MetricCard
              icon={Dumbbell}
              label="Adherencia entrenamiento"
              value={trainingValue}
              valueClass="text-emerald-400"
              hint={planDays > 0 ? 'Entrenos completados esta semana' : 'Entrenos de esta semana'}
              emptyHint="Sin entrenos registrados esta semana"
            />
          </div>

          {/* Estado del próximo check-in */}
          {daysUntilCheckin !== null && (
            <div
              className={`flex items-center gap-4 rounded-2xl border p-4 ${
                daysUntilCheckin <= 2
                  ? 'border-amber-500/20 bg-amber-500/[0.06]'
                  : 'border-emerald-500/15 bg-emerald-500/[0.05]'
              }`}
            >
              {daysUntilCheckin <= 2 ? (
                <Clock size={20} className="shrink-0 text-amber-400" />
              ) : (
                <CheckCircle2 size={20} className="shrink-0 text-emerald-400" />
              )}
              <div className="min-w-0 flex-1">
                <div className={`text-sm font-semibold ${daysUntilCheckin <= 2 ? 'text-amber-300' : 'text-emerald-300'}`}>
                  {daysUntilCheckin <= 0
                    ? 'Tu check-in está pendiente hoy'
                    : daysUntilCheckin === 1
                      ? 'Tu check-in es mañana'
                      : `Próximo check-in en ${daysUntilCheckin} días`}
                </div>
                <div className="mt-0.5 text-xs capitalize text-slate-500">
                  {nextCheckinDate.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
              </div>
              <Button
                size="sm"
                variant={daysUntilCheckin <= 2 ? 'primary' : 'secondary'}
                iconRight={ArrowRight}
                onClick={() => navigate('/mi-panel/check-ins')}
              >
                Cargar
              </Button>
            </div>
          )}

          {/* Resumen de la semana — datos reales */}
          {hasWeeklyData ? (
            <SectionCard title="Resumen de la semana" subtitle="Tu actividad hasta hoy">
              <div className="flex flex-col">
                <SummaryRow
                  icon={Scale}
                  label="Peso reciente"
                  value={currentWeight != null ? `${currentWeight} kg` : 'Sin registro'}
                  sub={currentWeightDate ? fmtShortDate(currentWeightDate) : null}
                  empty={currentWeight == null}
                />
                <SummaryRow
                  icon={Dumbbell}
                  label="Entrenamientos"
                  value={trainingsDone > 0 ? (planDays > 0 ? `${trainingsDone}/${planDays}` : `${trainingsDone}`) : 'Sin registro'}
                  sub={trainingsDone > 0 && planDays > 0 ? 'según tu plan' : null}
                  empty={trainingsDone === 0}
                />
                <SummaryRow
                  icon={ClipboardCheck}
                  label="Check-ins"
                  value={weekCheckins.length > 0 ? `${weekCheckins.length} esta semana` : 'Sin registro'}
                  empty={weekCheckins.length === 0}
                />
                {nutritionAdh != null && (
                  <SummaryRow
                    icon={Utensils}
                    label="Adherencia nutricional"
                    value={`${nutritionAdh}%`}
                  />
                )}
              </div>

              {lastCheckin?.coachFeedback && (
                <div className="mt-3 rounded-xl border border-accent/10 bg-accent/[0.06] p-3.5">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-accent">
                    <MessageSquare size={12} /> Nota reciente de tu coach
                  </div>
                  <p className="text-sm leading-relaxed text-slate-300">{lastCheckin.coachFeedback}</p>
                </div>
              )}
            </SectionCard>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.015] p-5">
              <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-300">
                <TrendingUp size={15} className="text-slate-500" strokeWidth={1.75} />
                Resumen de la semana
              </div>
              <p className="text-sm leading-relaxed text-slate-500">
                Todavía no hay suficiente información para calcular un resumen semanal. Cuando tengas
                check-ins y métricas cargadas, vas a poder ver tu evolución acá.
              </p>
            </div>
          )}

          {/* Mi plan nutricional (preview) */}
          {nutrition && (
            <SectionCard
              title="Mi plan nutricional"
              subtitle={nutrition.lastUpdate
                ? `Actualizado ${new Date(nutrition.lastUpdate).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}`
                : undefined}
              action={
                <Link
                  to="/mi-panel/nutricion"
                  className="flex items-center gap-1 rounded text-xs font-medium text-accent transition-colors hover:text-accent-light focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  Ver completo <ChevronRight size={13} />
                </Link>
              }
            >
              {/* Resumen de macros — el detalle de comidas vive en /mi-panel/nutricion.
                  Si un macro no está cargado mostramos "— g" en gris (no inventamos valores). */}
              <div className="flex items-center justify-between rounded-xl border border-accent/10 bg-accent/[0.06] p-4">
                <div className="flex items-center gap-3">
                  <Utensils size={20} className="text-accent" strokeWidth={1.75} />
                  <div>
                    <div className="text-xl font-bold text-white">{macroValue(nutrition.calories, '')}</div>
                    <div className="text-xs text-slate-500">kcal objetivo</div>
                  </div>
                </div>
                <div className="flex gap-4 text-right text-xs text-slate-500">
                  <div>P<div className={macroClass(nutrition.protein)}>{macroValue(nutrition.protein)}</div></div>
                  <div>C<div className={macroClass(nutrition.carbs)}>{macroValue(nutrition.carbs)}</div></div>
                  <div>G<div className={macroClass(nutrition.fat)}>{macroValue(nutrition.fat)}</div></div>
                </div>
              </div>
            </SectionCard>
          )}

          {/* Mi rutina (preview) */}
          {training && (
            <SectionCard
              title="Mi rutina de entrenamiento"
              subtitle={training.plan}
              action={
                <Link
                  to="/mi-panel/rutina"
                  className="flex items-center gap-1 rounded text-xs font-medium text-accent transition-colors hover:text-accent-light focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  Ver completa <ChevronRight size={13} />
                </Link>
              }
            >
              <div className="flex flex-col gap-4">
                {training.days?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {(() => {
                      // 0=Lunes … 5=Sábado, 6=Domingo — alineado con el array L M X J V S D
                      const todayIdx = (new Date().getDay() + 6) % 7
                      return ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d, i) => {
                        const dayMap = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
                        const active = training.days.includes(dayMap[i])
                        const isToday = i === todayIdx
                        return (
                          <div
                            key={d}
                            className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold ${
                              isToday
                                ? 'bg-rose-500 text-white'
                                : active
                                  ? 'bg-accent text-white'
                                  : 'bg-white/[0.04] text-slate-600'
                            }`}
                          >
                            {d}
                          </div>
                        )
                      })
                    })()}
                  </div>
                )}

                {training.exercises?.length > 0 && (
                  <div>
                    <div className="mb-2.5 text-xs font-medium text-slate-500">Ejercicios principales</div>
                    <div className="flex flex-col gap-2">
                      {training.exercises.slice(0, 4).map((ex, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 border-b border-white/[0.04] py-2 last:border-0">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-[10px] font-semibold text-slate-500">
                              {i + 1}
                            </div>
                            <div>
                              <div className="text-sm text-white">{ex.name}</div>
                              {ex.notes && <div className="text-xs text-slate-600">{ex.notes}</div>}
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-3 text-right">
                            {ex.sets > 0 && <span className="text-xs text-slate-400">{ex.sets}×{ex.reps}</span>}
                            {ex.load && <span className="text-xs font-semibold text-accent">{ex.load}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {/* Mi progreso (preview) */}
          {progress && (
            <SectionCard
              title="Mi progreso"
              subtitle="Evolución de peso"
              action={
                <Link
                  to="/mi-panel/progreso"
                  className="flex items-center gap-1 rounded text-xs font-medium text-accent transition-colors hover:text-accent-light focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  Ver detalle <ChevronRight size={13} />
                </Link>
              }
            >
              <div className="flex flex-col gap-4">
                {progress.weightHistory?.length > 0 && (
                  <div className="flex h-20 items-end gap-1.5">
                    {progress.weightHistory.map((w, i) => {
                      const max = Math.max(...progress.weightHistory)
                      const min = Math.min(...progress.weightHistory) - 0.5
                      const range = max - min || 1
                      const heightPct = ((w - min) / range) * 70 + 20
                      const isLast = i === progress.weightHistory.length - 1
                      return (
                        <div key={i} className="flex flex-1 flex-col items-center gap-1">
                          {isLast && <span className="text-[9px] font-bold text-emerald-400">{w}</span>}
                          <div
                            className={`w-full rounded-t-md ${isLast ? 'bg-accent' : 'bg-accent/30'}`}
                            style={{ height: `${heightPct}%` }}
                          />
                          <span className="text-[9px] text-slate-600">{progress.dates?.[i]}</span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {progress.weightHistory?.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-white/[0.03] p-3 text-center">
                      <div className="mb-0.5 text-xs text-slate-500">Inicio</div>
                      <div className="font-bold text-white">{progress.weightHistory[0]} kg</div>
                    </div>
                    <div className="rounded-xl bg-white/[0.03] p-3 text-center">
                      <div className="mb-0.5 text-xs text-slate-500">Actual</div>
                      <div className="font-bold text-emerald-400">{currentWeight ?? client.weight} kg</div>
                    </div>
                    <div className="rounded-xl bg-accent/10 p-3 text-center">
                      <div className="mb-0.5 text-xs text-slate-500">Objetivo</div>
                      <div className="font-bold text-accent">{client.targetWeight} kg</div>
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {/* Último check-in */}
          {lastCheckin && (
            <SectionCard
              title="Mi último check-in"
              subtitle={`${lastCheckin.week ? `Semana ${lastCheckin.week} · ` : ''}${new Date(lastCheckin.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}`}
              action={<Badge variant={lastCheckin.decision} />}
            >
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Energía', value: lastCheckin.energy },
                    { label: 'Sueño', value: lastCheckin.sleep },
                    { label: 'Estrés', value: lastCheckin.stress },
                    { label: 'Hambre', value: lastCheckin.hunger },
                  ].map((m) => (
                    <div key={m.label} className="rounded-xl bg-white/[0.02] p-2.5 text-center">
                      <div className="mb-1 text-[10px] text-slate-600">{m.label}</div>
                      <div className="flex justify-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div key={i} className={`h-1.5 w-1.5 rounded-full ${i <= m.value ? 'bg-accent' : 'bg-white/10'}`} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {lastCheckin.coachFeedback && (
                  <div className="rounded-xl border border-accent/10 bg-accent/[0.06] p-3.5">
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-accent">
                      <MessageSquare size={12} /> Feedback de tu coach
                    </div>
                    <p className="text-sm leading-relaxed text-slate-300">{lastCheckin.coachFeedback}</p>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {/* Indicaciones del coach */}
          {(client.weeklyGoal || client.limitations || client.internalNotes) && (
            <SectionCard title="Indicaciones del coach" subtitle="Últimas notas para esta semana">
              <div className="flex flex-col gap-3">
                {client.weeklyGoal && (
                  <div className="flex items-start gap-3 rounded-xl bg-white/[0.02] p-3.5">
                    <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-400" />
                    <div>
                      <div className="text-sm font-medium text-white">{client.weeklyGoal}</div>
                      <div className="mt-0.5 text-xs text-slate-500">Objetivo de la semana</div>
                    </div>
                  </div>
                )}
                {client.limitations && (
                  <div className="flex items-start gap-3 rounded-xl border border-amber-500/10 bg-amber-500/[0.05] p-3.5">
                    <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-400" />
                    <div>
                      <div className="mb-0.5 text-xs font-semibold text-amber-300">Tener en cuenta</div>
                      <div className="text-sm text-slate-300">{client.limitations}</div>
                    </div>
                  </div>
                )}
                {client.internalNotes && (
                  <div className="rounded-xl bg-white/[0.02] p-3.5">
                    <div className="mb-1 text-xs text-slate-500">Notas internas</div>
                    <p className="text-sm leading-relaxed text-slate-300">{client.internalNotes}</p>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {/* Seguimiento — accesos fijos disponibles para todos los asesorados */}
          <section className="flex flex-col gap-3">
            <h2 className="px-1 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Seguimiento
            </h2>
            <Link
              to="/mi-panel/check-ins"
              className="group flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-surface-800 p-5 transition-all hover:-translate-y-0.5 hover:border-accent/25 hover:bg-surface-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 transition-colors group-hover:bg-accent/20">
                <ClipboardCheck size={20} className="text-accent" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-white">Check-ins</div>
                <div className="mt-0.5 text-xs leading-snug text-slate-500">Historial semanal y registro</div>
              </div>
              <ChevronRight size={17} className="shrink-0 text-slate-600 transition-all group-hover:translate-x-0.5 group-hover:text-accent" />
            </Link>
            <Link
              to="/mi-panel/progreso"
              className="group flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-surface-800 p-5 transition-all hover:-translate-y-0.5 hover:border-accent/25 hover:bg-surface-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 transition-colors group-hover:bg-accent/20">
                <TrendingUp size={20} className="text-accent" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-white">Mi progreso</div>
                <div className="mt-0.5 text-xs leading-snug text-slate-500">Evolución de peso y medidas</div>
              </div>
              <ChevronRight size={17} className="shrink-0 text-slate-600 transition-all group-hover:translate-x-0.5 group-hover:text-accent" />
            </Link>
          </section>

        </div>
      </div>
    </div>
  )
}
