import { useState, useEffect } from 'react'
import { Dumbbell, Zap, AlertCircle, ChevronDown, Video } from 'lucide-react'
import { getMyWorkoutPlan } from '../services/workoutService'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { SubpageHeader, PanelEmpty, BackToPanel } from '../components/panel/PanelUI'

// ── Card de ejercicio principal ──────────────────────────────────────────────
// videoUrl: cuando el backend lo provea (exercise.videoUrl), activar el botón.
// Por ahora siempre undefined → botón deshabilitado.
function ExerciseCard({ exercise, index }) {
  const repsText = exercise.reps != null && exercise.reps !== '' ? String(exercise.reps) : null
  const hasVideo = Boolean(exercise.videoUrl)

  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-[10px] font-semibold text-slate-500">
        {index + 1}
      </span>

      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium leading-snug text-white">{exercise.name}</div>
        {exercise.notes && <div className="mt-1 text-xs leading-relaxed text-slate-500">{exercise.notes}</div>}

        {/* Acción de video — habilitada cuando exista exercise.videoUrl */}
        {hasVideo ? (
          <button
            type="button"
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-accent/15 px-2.5 py-1 text-[11px] font-medium text-accent transition-colors hover:bg-accent/25"
            aria-label={`Ver video de ejecución: ${exercise.name}`}
          >
            <Video size={12} />
            Ver video
          </button>
        ) : (
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Video de ejecución — disponible próximamente"
            className="mt-2 inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-white/[0.04] bg-white/[0.02] px-2.5 py-1 text-[11px] text-slate-600"
          >
            <Video size={12} />
            Video
          </button>
        )}
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

// ── Acordeón de día de entrenamiento ────────────────────────────────────────
// Calentamiento (day.warmup) existe en los datos pero NO se renderiza por decisión de producto.
function DayAccordion({ day, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-surface-800">
      {/* Header — siempre visible, tap-target ≥44px */}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-white/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        style={{ minHeight: '44px' }}
      >
        <span className="shrink-0 rounded-lg bg-accent/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
          {day.day}
        </span>
        <span className="min-w-0 flex-1 text-sm font-semibold leading-snug text-white">{day.focus}</span>
        <ChevronDown
          size={16}
          className="shrink-0 text-slate-500 transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      {/* Contenido colapsable — ejercicios */}
      {open && (
        <div className="border-t border-white/[0.04] px-5 py-5">
          {day.exercises?.length > 0 ? (
            <div className="flex flex-col gap-2">
              {day.exercises.map((ex, i) => (
                <ExerciseCard key={i} exercise={ex} index={i} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-600">Sin ejercicios cargados para este día.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Nota del coach compacta con acordeón ────────────────────────────────────
const NOTES_PREVIEW_LENGTH = 140

function CoachNotes({ notes }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = notes.length > NOTES_PREVIEW_LENGTH
  const preview = isLong ? notes.slice(0, NOTES_PREVIEW_LENGTH).trimEnd() + '…' : notes

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-surface-800 px-5 py-4">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent/20">
          <Zap size={11} className="text-accent" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-accent">Indicaciones del coach</span>
      </div>

      {/* Texto */}
      <p className="text-sm leading-relaxed text-slate-300">
        {expanded || !isLong ? notes : preview}
      </p>

      {/* Acordeón — solo si el texto es largo */}
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 flex items-center gap-1.5 text-xs font-medium text-slate-400 transition-colors hover:text-white"
        >
          <ChevronDown
            size={13}
            className="transition-transform duration-200"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
          {expanded ? 'Ver menos' : 'Ver indicaciones completas'}
        </button>
      )}
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

          {plan.notes && <CoachNotes notes={plan.notes} />}

          {plan.days?.length > 0 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-sm font-semibold text-white">
                Días de entrenamiento{' '}
                <span className="font-normal text-slate-600">({plan.days.length} días)</span>
              </h2>
              {plan.days.map((day, i) => (
                <DayAccordion key={i} day={day} defaultOpen={i === 0} />
              ))}
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
