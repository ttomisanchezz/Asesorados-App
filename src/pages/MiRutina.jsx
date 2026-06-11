import { useState, useEffect, useCallback } from 'react'
import {
  Dumbbell, Zap, AlertCircle, ChevronDown, Video, History,
  Plus, X, Check, Loader2, ClipboardList,
} from 'lucide-react'
import { getMyWorkoutPlan } from '../services/workoutService'
import {
  getMyLastLogsByExercise, saveWorkoutSession, parseSetsCount,
} from '../services/workoutLogService'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { SubpageHeader, PanelEmpty, BackToPanel } from '../components/panel/PanelUI'

// Parsers tolerantes para los inputs del registro.
const toDec = (v) => {
  if (v == null || String(v).trim() === '') return null
  const n = parseFloat(String(v).replace(',', '.'))
  return Number.isNaN(n) ? null : Math.round(n * 100) / 100
}
const toInt = (v) => {
  if (v == null || String(v).trim() === '') return null
  const n = parseInt(String(v), 10)
  return Number.isNaN(n) ? null : n
}

// ── Referencia "última vez" de un ejercicio ──────────────────────────────────
function LastReference({ last }) {
  if (!last) {
    return (
      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-600">
        <History size={12} /> Sin registro previo
      </div>
    )
  }
  const parts = []
  if (last.weight != null) parts.push(`${last.weight} kg`)
  if (last.reps != null) parts.push(`${last.reps} reps`)
  return (
    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-accent-light">
      <History size={12} />
      <span className="font-medium">Última vez:</span> {parts.join(' × ') || 'registro previo'}
    </div>
  )
}

// ── Card de ejercicio (vista de lectura) ─────────────────────────────────────
function ExerciseCard({ exercise, index, last }) {
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

        <LastReference last={last} />

        {hasVideo && (
          <a
            href={exercise.videoUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-accent/15 px-2.5 py-1 text-[11px] font-medium text-accent transition-colors hover:bg-accent/25"
            aria-label={`Ver video de ejecución: ${exercise.name}`}
          >
            <Video size={12} />
            Ver video
          </a>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1 text-right">
        {exercise.sets && <span className="text-xs font-semibold text-accent">{exercise.sets} series</span>}
        {repsText ? (
          <span className="text-xs text-slate-300">{repsText} reps</span>
        ) : (
          <span className="text-xs italic text-slate-600">Según indicación</span>
        )}
        {exercise.rir != null && exercise.rir !== '' && (
          <span className="text-[10px] text-slate-600">RIR {exercise.rir}</span>
        )}
        {exercise.rest != null && exercise.rest !== '' && (
          <span className="text-[10px] text-slate-600">Descanso {exercise.rest}</span>
        )}
      </div>
    </div>
  )
}

// ── Editor de series de un ejercicio (modo registro) ─────────────────────────
function ExerciseLogger({ exercise, index, last, sets, onChange }) {
  const setRow = (i, field, value) => {
    const next = sets.map((s, k) => (k === i ? { ...s, [field]: value } : s))
    onChange(next)
  }
  const addSet = () => onChange([...sets, { weight: '', reps: '' }])
  const removeSet = (i) => onChange(sets.length > 1 ? sets.filter((_, k) => k !== i) : sets)

  return (
    <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-[10px] font-semibold text-slate-500">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium leading-snug text-white">{exercise.name}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
            {exercise.sets && <span>{exercise.sets} series objetivo</span>}
            {exercise.rir != null && exercise.rir !== '' && <span>· RIR {exercise.rir}</span>}
          </div>
          <LastReference last={last} />
        </div>
      </div>

      {/* Filas de series */}
      <div className="mt-3 flex flex-col gap-2">
        <div className="flex items-center gap-2 px-1 text-[10px] font-medium uppercase tracking-wide text-slate-600">
          <span className="w-12 shrink-0">Serie</span>
          <span className="flex-1 text-center">Peso (kg)</span>
          <span className="flex-1 text-center">Reps</span>
          <span className="w-6 shrink-0" />
        </div>
        {sets.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="flex h-9 w-12 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-xs font-semibold text-slate-400">
              {i + 1}
            </span>
            <input
              type="number"
              inputMode="decimal"
              step="0.5"
              value={s.weight}
              onChange={(e) => setRow(i, 'weight', e.target.value)}
              placeholder={last?.weight != null ? String(last.weight) : '—'}
              aria-label={`Peso serie ${i + 1} de ${exercise.name}`}
              className="h-9 w-full flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-center text-sm font-semibold text-white outline-none transition-colors placeholder:text-slate-600 focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/40"
            />
            <input
              type="number"
              inputMode="numeric"
              step="1"
              value={s.reps}
              onChange={(e) => setRow(i, 'reps', e.target.value)}
              placeholder={last?.reps != null ? String(last.reps) : '—'}
              aria-label={`Repeticiones serie ${i + 1} de ${exercise.name}`}
              className="h-9 w-full flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-center text-sm font-semibold text-white outline-none transition-colors placeholder:text-slate-600 focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/40"
            />
            <button
              type="button"
              onClick={() => removeSet(i)}
              disabled={sets.length <= 1}
              aria-label={`Quitar serie ${i + 1}`}
              className="flex h-9 w-6 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:text-rose-400 disabled:opacity-30 disabled:hover:text-slate-600"
            >
              <X size={14} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addSet}
          className="mt-0.5 inline-flex items-center gap-1.5 self-start rounded-lg px-1 py-1 text-[11px] font-medium text-accent transition-colors hover:text-accent-light"
        >
          <Plus size={12} /> Agregar serie
        </button>
      </div>
    </div>
  )
}

// ── Acordeón de día — lectura + registro ─────────────────────────────────────
function DayAccordion({ day, defaultOpen, planId, lastLogs, onSaved }) {
  const [open, setOpen] = useState(defaultOpen)
  const [logging, setLogging] = useState(false)
  const [form, setForm] = useState([]) // por ejercicio: [{ weight, reps }]
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null) // { type, text }

  const exercises = day.exercises ?? []

  const startLogging = () => {
    setForm(
      exercises.map((ex) =>
        Array.from({ length: parseSetsCount(ex.sets) }, () => ({ weight: '', reps: '' })),
      ),
    )
    setNote('')
    setMsg(null)
    setLogging(true)
  }

  const cancelLogging = () => {
    setLogging(false)
    setMsg(null)
  }

  async function handleSave() {
    setMsg(null)
    const payloadExercises = exercises.map((ex, i) => ({
      name: ex.name,
      order: i,
      targetReps: ex.reps ?? null,
      sets: (form[i] ?? []).map((s, si) => ({
        setNumber: si + 1,
        weight: toDec(s.weight),
        reps: toInt(s.reps),
        rir: null,
      })),
    }))

    const anyData = payloadExercises.some((ex) => ex.sets.some((s) => s.weight != null || s.reps != null))
    if (!anyData) {
      setMsg({ type: 'error', text: 'Cargá al menos una serie con peso o repeticiones.' })
      return
    }

    setSaving(true)
    const { error, reason, count } = await saveWorkoutSession({
      workoutPlanId: planId,
      dayKey: day.day,
      dayName: day.focus,
      notes: note.trim() || undefined,
      exercises: payloadExercises,
    })
    setSaving(false)

    if (error) {
      setMsg({
        type: 'error',
        text: reason === 'no-client'
          ? 'No encontramos tu perfil de asesorado vinculado. Contactá a tu coach.'
          : error.message || 'No se pudo guardar el entrenamiento.',
      })
      return
    }

    setMsg({ type: 'ok', text: `Entrenamiento guardado (${count} series).` })
    setLogging(false)
    onSaved?.()
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-surface-800">
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

      {open && (
        <div className="border-t border-white/[0.04] px-5 py-5">
          {exercises.length === 0 ? (
            <p className="text-xs text-slate-600">Sin ejercicios cargados para este día.</p>
          ) : !logging ? (
            <>
              <div className="flex flex-col gap-2">
                {exercises.map((ex, i) => (
                  <ExerciseCard key={i} exercise={ex} index={i} last={lastLogs[ex.name]} />
                ))}
              </div>
              <button
                type="button"
                onClick={startLogging}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-accent/25 bg-accent/[0.08] py-3 text-sm font-semibold text-accent transition-all hover:bg-accent/[0.14] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                <ClipboardList size={16} /> Registrar entrenamiento
              </button>
            </>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-2 text-xs font-medium text-slate-400">
                <ClipboardList size={14} className="text-accent" />
                Registrá peso y reps de cada serie. Intentá igualar o superar tu última vez con buena técnica.
              </div>

              <div className="flex flex-col gap-2">
                {exercises.map((ex, i) => (
                  <ExerciseLogger
                    key={i}
                    exercise={ex}
                    index={i}
                    last={lastLogs[ex.name]}
                    sets={form[i] ?? [{ weight: '', reps: '' }]}
                    onChange={(next) => setForm((f) => f.map((s, k) => (k === i ? next : s)))}
                  />
                ))}
              </div>

              {/* Nota del entrenamiento */}
              <div className="mt-3 flex flex-col gap-1.5">
                <label htmlFor={`nota-${day.day}`} className="text-xs text-slate-500">Nota del entrenamiento (opcional)</label>
                <input
                  id={`nota-${day.day}`}
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Cómo te sentiste, molestias, energía…"
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/40"
                />
              </div>

              {msg && (
                <div
                  className={`mt-3 flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm ${
                    msg.type === 'ok'
                      ? 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-300'
                      : 'border-rose-500/20 bg-rose-500/[0.06] text-rose-300'
                  }`}
                >
                  {msg.type === 'ok' ? <Check size={15} className="shrink-0" /> : <AlertCircle size={15} className="shrink-0" />}
                  {msg.text}
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white shadow-glow transition-all hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  {saving ? <><Loader2 size={16} className="animate-spin" /> Guardando…</> : 'Guardar entrenamiento'}
                </button>
                <button
                  type="button"
                  onClick={cancelLogging}
                  disabled={saving}
                  className="rounded-xl border border-white/[0.08] px-4 py-3 text-sm text-slate-400 transition-colors hover:text-white disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  Cancelar
                </button>
              </div>
            </>
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
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent/20">
          <Zap size={11} className="text-accent" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-accent">Indicaciones del coach</span>
      </div>

      <p className="text-sm leading-relaxed text-slate-300">
        {expanded || !isLong ? notes : preview}
      </p>

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
  const [planId, setPlanId] = useState(null)
  const [lastLogs, setLastLogs] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refreshLogs = useCallback(async () => {
    const { data } = await getMyLastLogsByExercise()
    setLastLogs(data ?? {})
  }, [])

  useEffect(() => {
    Promise.all([getMyWorkoutPlan(), getMyLastLogsByExercise()])
      .then(([planRes, logsRes]) => {
        const err = planRes.error
        const noRows = err?.code === 'PGRST116'
        if (err && !noRows) setError(err.message || 'Error al cargar la rutina')
        setPlan(planRes.data ?? null)
        setPlanId(planRes.data?.id ?? null)
        setLastLogs(logsRes.data ?? {})
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-[100dvh] bg-surface-900 pb-12">
      <SubpageHeader title="Mi rutina" subtitle="Ejercicios, series y registro" />

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
            <p className="mt-0.5 text-sm text-slate-500">Ejercicios, cargas y registro de tus entrenamientos</p>
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
                <DayAccordion
                  key={i}
                  day={day}
                  defaultOpen={i === 0}
                  planId={planId}
                  lastLogs={lastLogs}
                  onSaved={refreshLogs}
                />
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
