import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Dumbbell, Zap, AlertCircle } from 'lucide-react'
import { getMyWorkoutPlan } from '../services/workoutService'
import { PageLoader } from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'

// ── Header de sub-página ─────────────────────────────────────────────────────
function SubHeader({ title }) {
  const navigate = useNavigate()
  return (
    <header className="sticky top-0 z-40 flex items-center gap-3 px-4 py-4 bg-[#0a0a0f]/95 backdrop-blur-md border-b border-white/[0.06]">
      <button
        onClick={() => navigate('/mi-panel')}
        aria-label="Volver al panel"
        className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/[0.05] hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft size={15} />
      </button>
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg bg-accent flex items-center justify-center">
          <Zap size={11} className="text-white" />
        </div>
        <span className="text-white font-semibold text-sm tracking-tight">{title}</span>
      </div>
    </header>
  )
}

// ── Fila de ejercicio de calentamiento ───────────────────────────────────────
function WarmupRow({ exercise }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-white/[0.04] last:border-0">
      <div className="flex-1 min-w-0">
        <div className="text-slate-300 text-sm leading-snug">{exercise.name}</div>
        {exercise.notes && (
          <div className="text-slate-600 text-xs mt-0.5 leading-relaxed">{exercise.notes}</div>
        )}
      </div>
      <div className="flex flex-col items-end gap-0.5 shrink-0 text-right">
        {exercise.sets && (
          <span className="text-slate-400 text-xs">{exercise.sets} series</span>
        )}
        {exercise.rir != null && (
          <span className="text-slate-600 text-[10px]">RIR {exercise.rir}</span>
        )}
      </div>
    </div>
  )
}

// ── Card de ejercicio principal ──────────────────────────────────────────────
function ExerciseCard({ exercise, index }) {
  // reps puede ser null (no confirmado) o un string/número
  const repsText =
    exercise.reps != null && exercise.reps !== ''
      ? String(exercise.reps)
      : null

  return (
    <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-4 flex items-start gap-3">
      {/* Número */}
      <span className="w-6 h-6 rounded-lg bg-white/[0.05] flex items-center justify-center text-slate-500 text-[10px] font-semibold shrink-0 mt-0.5">
        {index + 1}
      </span>

      {/* Nombre + notas */}
      <div className="flex-1 min-w-0">
        <div className="text-white text-sm font-medium leading-snug">{exercise.name}</div>
        {exercise.notes && (
          <div className="text-slate-500 text-xs mt-1 leading-relaxed">{exercise.notes}</div>
        )}
      </div>

      {/* Métricas */}
      <div className="flex flex-col items-end gap-1 shrink-0 text-right">
        {exercise.sets && (
          <span className="text-accent text-xs font-semibold">{exercise.sets} series</span>
        )}
        {repsText ? (
          <span className="text-slate-300 text-xs">{repsText} reps</span>
        ) : (
          <span className="text-slate-600 text-xs italic">Según indicación</span>
        )}
        {exercise.rir != null && (
          <span className="text-slate-600 text-[10px]">RIR {exercise.rir}</span>
        )}
      </div>
    </div>
  )
}

// ── Card de día de entrenamiento ─────────────────────────────────────────────
function DayCard({ day }) {
  return (
    <div className="bg-[#111118] border border-white/[0.06] rounded-2xl overflow-hidden">
      {/* Header del día */}
      <div className="px-5 pt-5 pb-4 border-b border-white/[0.04]">
        <span className="inline-flex px-2.5 py-0.5 rounded-lg bg-accent/15 text-accent text-[10px] font-bold uppercase tracking-wide mb-2">
          {day.day}
        </span>
        <h3 className="text-white font-semibold text-sm leading-snug">{day.focus}</h3>
      </div>

      <div className="px-5 py-5 flex flex-col gap-5">
        {/* Calentamiento */}
        {day.warmup?.length > 0 && (
          <div>
            <div className="text-slate-500 text-xs font-semibold uppercase tracking-widest mb-3">
              Calentamiento
            </div>
            <div className="bg-white/[0.02] rounded-xl px-4 py-1">
              {day.warmup.map((ex, i) => (
                <WarmupRow key={i} exercise={ex} />
              ))}
            </div>
          </div>
        )}

        {/* Ejercicios principales */}
        {day.exercises?.length > 0 && (
          <div>
            <div className="text-slate-500 text-xs font-semibold uppercase tracking-widest mb-3">
              Ejercicios
            </div>
            <div className="flex flex-col gap-2">
              {day.exercises.map((ex, i) => (
                <ExerciseCard key={i} exercise={ex} index={i} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function MiRutina() {
  const navigate  = useNavigate()
  const [plan, setPlan]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    getMyWorkoutPlan()
      .then(({ data, error: err }) => {
        const noRows = err?.code === 'PGRST116'
        if (err && !noRows) setError(err.message || 'Error al cargar la rutina')
        setPlan(data ?? null)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-[#0a0a0f] pb-10">
      <SubHeader title="Mi rutina" />

      {loading && <PageLoader label="Cargando tu rutina..." />}

      {!loading && error && !plan && (
        <EmptyState
          icon={AlertCircle}
          title="No se pudo cargar la rutina"
          description={error}
        />
      )}

      {!loading && !error && !plan && (
        <EmptyState
          icon={Dumbbell}
          title="No hay rutina activa"
          description="Tu coach todavía no cargó tu entrenamiento."
        />
      )}

      {!loading && plan && (
        <div className="max-w-2xl mx-auto px-4 pt-6 flex flex-col gap-6">

          {/* Intro */}
          <div>
            <h1 className="text-xl font-bold text-white">Mi rutina</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Ejercicios y cargas de tu plan actual
            </p>
          </div>

          {/* Nombre del plan */}
          {plan.plan && (
            <div className="bg-[#111118] border border-white/[0.06] rounded-xl px-5 py-4">
              <div className="text-slate-500 text-xs mb-1">Plan activo</div>
              <div className="text-white font-semibold text-sm">{plan.plan}</div>
            </div>
          )}

          {/* Nota del coach */}
          {plan.notes && (
            <div className="bg-accent/5 border border-accent/15 rounded-xl p-4 flex items-start gap-3">
              <div className="w-7 h-7 rounded-xl bg-accent/20 flex items-center justify-center shrink-0 mt-0.5">
                <Zap size={12} className="text-accent" />
              </div>
              <div>
                <div className="text-accent text-xs font-semibold mb-1">Nota del coach</div>
                <p className="text-slate-300 text-sm leading-relaxed">{plan.notes}</p>
              </div>
            </div>
          )}

          {/* Días de entrenamiento */}
          {plan.days?.length > 0 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-white font-semibold text-sm">
                Días de entrenamiento{' '}
                <span className="text-slate-600 font-normal">({plan.days.length} días)</span>
              </h2>
              {plan.days.map((day, i) => (
                <DayCard key={i} day={day} />
              ))}
            </div>
          )}

          {/* Aclaración sobre reps */}
          <p className="text-slate-600 text-xs leading-relaxed">
            Los valores marcados como "Según indicación" serán confirmados por tu coach en la próxima revisión.
          </p>

          {/* Volver */}
          <button
            onClick={() => navigate('/mi-panel')}
            className="flex items-center gap-2 text-slate-500 hover:text-white text-sm transition-colors self-start mt-2"
          >
            <ArrowLeft size={14} />
            Volver a mi panel
          </button>

        </div>
      )}
    </div>
  )
}
