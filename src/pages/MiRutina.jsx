import { useState, useEffect } from 'react'
import { Dumbbell, Zap, AlertCircle } from 'lucide-react'
import { getMyWorkoutPlan } from '../services/workoutService'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { SubpageHeader, PanelEmpty, BackToPanel } from '../components/panel/PanelUI'

// ── Fila de ejercicio de calentamiento ───────────────────────────────────────
function WarmupRow({ exercise }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/[0.04] py-2.5 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="text-sm leading-snug text-slate-300">{exercise.name}</div>
        {exercise.notes && <div className="mt-0.5 text-xs leading-relaxed text-slate-600">{exercise.notes}</div>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
        {exercise.sets && <span className="text-xs text-slate-400">{exercise.sets} series</span>}
        {exercise.rir != null && <span className="text-[10px] text-slate-600">RIR {exercise.rir}</span>}
      </div>
    </div>
  )
}

// ── Card de ejercicio principal ──────────────────────────────────────────────
function ExerciseCard({ exercise, index }) {
  const repsText = exercise.reps != null && exercise.reps !== '' ? String(exercise.reps) : null

  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-[10px] font-semibold text-slate-500">
        {index + 1}
      </span>

      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium leading-snug text-white">{exercise.name}</div>
        {exercise.notes && <div className="mt-1 text-xs leading-relaxed text-slate-500">{exercise.notes}</div>}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1 text-right">
        {exercise.sets && <span className="text-xs font-semibold text-accent">{exercise.sets} series</span>}
        {repsText ? (
          <span className="text-xs text-slate-300">{repsText} reps</span>
        ) : (
          <span className="text-xs italic text-slate-600">Según indicación</span>
        )}
        {exercise.rir != null && <span className="text-[10px] text-slate-600">RIR {exercise.rir}</span>}
      </div>
    </div>
  )
}

// ── Card de día de entrenamiento ─────────────────────────────────────────────
function DayCard({ day }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-surface-800">
      <div className="border-b border-white/[0.04] px-5 pb-4 pt-5">
        <span className="mb-2 inline-flex rounded-lg bg-accent/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
          {day.day}
        </span>
        <h3 className="text-sm font-semibold leading-snug text-white">{day.focus}</h3>
      </div>

      <div className="flex flex-col gap-5 px-5 py-5">
        {day.warmup?.length > 0 && (
          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Calentamiento</div>
            <div className="rounded-xl bg-white/[0.02] px-4 py-1">
              {day.warmup.map((ex, i) => <WarmupRow key={i} exercise={ex} />)}
            </div>
          </div>
        )}

        {day.exercises?.length > 0 && (
          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Ejercicios</div>
            <div className="flex flex-col gap-2">
              {day.exercises.map((ex, i) => <ExerciseCard key={i} exercise={ex} index={i} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function MiRutina() {
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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
    <div className="min-h-[100dvh] bg-surface-900 pb-12">
      <SubpageHeader title="Mi rutina" subtitle="Ejercicios, series y cargas" />

      {loading && <PageLoader label="Cargando tu rutina..." />}

      {!loading && error && !plan && (
        <PanelEmpty
          icon={AlertCircle}
          tone="danger"
          title="No se pudo cargar la rutina"
          description={error}
        />
      )}

      {!loading && !error && !plan && (
        <PanelEmpty
          icon={Dumbbell}
          title="Tu rutina todavía no fue cargada"
          description="Cuando tu coach cargue tu entrenamiento, vas a ver acá tus días, ejercicios y cargas."
        />
      )}

      {!loading && plan && (
        <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 pt-6">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Mi rutina</h1>
            <p className="mt-0.5 text-sm text-slate-500">Ejercicios y cargas de tu plan actual</p>
          </div>

          {plan.plan && (
            <div className="rounded-2xl border border-white/[0.06] bg-surface-800 px-5 py-4">
              <div className="mb-1 text-xs text-slate-500">Plan activo</div>
              <div className="text-sm font-semibold text-white">{plan.plan}</div>
            </div>
          )}

          {plan.notes && (
            <div className="flex items-start gap-3 rounded-xl border border-accent/15 bg-accent/[0.06] p-4">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-accent/20">
                <Zap size={12} className="text-accent" />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-accent">Nota del coach</div>
                <p className="text-sm leading-relaxed text-slate-300">{plan.notes}</p>
              </div>
            </div>
          )}

          {plan.days?.length > 0 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-sm font-semibold text-white">
                Días de entrenamiento <span className="font-normal text-slate-600">({plan.days.length} días)</span>
              </h2>
              {plan.days.map((day, i) => <DayCard key={i} day={day} />)}
            </div>
          )}

          <p className="text-xs leading-relaxed text-slate-600">
            Los valores marcados como "Según indicación" serán confirmados por tu coach en la próxima revisión.
          </p>

          <BackToPanel />
        </div>
      )}
    </div>
  )
}
