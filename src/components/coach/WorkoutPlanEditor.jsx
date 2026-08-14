import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

const inputClass = 'w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-accent/50'
const labelClass = 'mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500'
const emptyExercise = () => ({ name: '', sets: '', reps: '', rir: '', rest: '', load: '', videoUrl: '', notes: '' })
const emptyDay = () => ({ day: '', focus: '', exercises: [emptyExercise()] })

function initialDays(plan) {
  const days = Array.isArray(plan.days) ? plan.days : []
  const topLevel = Array.isArray(plan.exercises) ? plan.exercises : []
  if (days.length) {
    const hasNestedDays = days.some((day) => day && typeof day === 'object')
    return days.map((day, index) => day && typeof day === 'object' ? structuredClone(day) : ({
      day: String(day), focus: '',
      exercises: !hasNestedDays && index === 0 ? structuredClone(topLevel) : [],
    }))
  }
  if (topLevel.length) return [{ day: 'Día 1', focus: '', exercises: structuredClone(topLevel) }]
  return [emptyDay()]
}

function Field({ label, ...props }) {
  return <label><span className={labelClass}>{label}</span><input className={inputClass} {...props} /></label>
}

export default function WorkoutPlanEditor({ initialPlan = {}, onSubmit, submitLabel = 'Guardar', busy = false }) {
  const [draft, setDraft] = useState(() => ({
    title: initialPlan.title || initialPlan.plan || '', notes: initialPlan.notes || '',
    days: initialDays(initialPlan),
  }))
  const updateDay = (di, updater) => setDraft((old) => ({ ...old, days: old.days.map((day, i) => i === di ? updater(day) : day) }))

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ title: draft.title, notes: draft.notes, days: draft.days, exercises: [] }) }} className="flex flex-col gap-5">
      <Field label="Nombre de la rutina" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Rutina 4 días" required />
      <div className="flex flex-col gap-4">
        {draft.days.map((day, di) => (
          <div key={di} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
            <div className="mb-3 flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-accent">Día {di + 1}</span><button type="button" onClick={() => setDraft({ ...draft, days: draft.days.filter((_, i) => i !== di) })} className="text-slate-600 hover:text-rose-400"><Trash2 size={15} /></button></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Identificador" value={day.day || ''} onChange={(e) => updateDay(di, (d) => ({ ...d, day: e.target.value }))} placeholder="Día 1" />
              <Field label="Foco" value={day.focus || ''} onChange={(e) => updateDay(di, (d) => ({ ...d, focus: e.target.value }))} placeholder="Pierna" />
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {(day.exercises ?? []).map((exercise, ei) => {
                const updateExercise = (patch) => updateDay(di, (d) => ({ ...d, exercises: d.exercises.map((ex, i) => i === ei ? { ...ex, ...patch } : ex) }))
                return (
                  <div key={ei} className="grid gap-2 rounded-xl bg-black/15 p-3 sm:grid-cols-12">
                    <div className="sm:col-span-4"><Field label={`Ejercicio ${ei + 1}`} value={exercise.name || ''} onChange={(e) => updateExercise({ name: e.target.value })} required /></div>
                    <div className="sm:col-span-2"><Field label="Series" value={exercise.sets ?? ''} onChange={(e) => updateExercise({ sets: e.target.value })} placeholder="3-4" /></div>
                    <div className="sm:col-span-2"><Field label="Reps" value={exercise.reps ?? ''} onChange={(e) => updateExercise({ reps: e.target.value })} placeholder="8-12" /></div>
                    <div className="sm:col-span-1"><Field label="RIR" value={exercise.rir ?? ''} onChange={(e) => updateExercise({ rir: e.target.value })} /></div>
                    <div className="sm:col-span-2"><Field label="Descanso" value={exercise.rest ?? ''} onChange={(e) => updateExercise({ rest: e.target.value })} /></div>
                    <button type="button" onClick={() => updateDay(di, (d) => ({ ...d, exercises: d.exercises.filter((_, i) => i !== ei) }))} className="self-end justify-self-center pb-2 text-slate-600 hover:text-rose-400"><Trash2 size={15} /></button>
                    <div className="sm:col-span-2"><Field label="Carga indicada" value={exercise.load || ''} onChange={(e) => updateExercise({ load: e.target.value })} /></div>
                    <div className="sm:col-span-5"><Field label="Video" type="url" value={exercise.videoUrl || ''} onChange={(e) => updateExercise({ videoUrl: e.target.value })} placeholder="https://…" /></div>
                    <div className="sm:col-span-5"><Field label="Notas / técnica" value={exercise.notes || ''} onChange={(e) => updateExercise({ notes: e.target.value })} /></div>
                  </div>
                )
              })}
            </div>
            <button type="button" onClick={() => updateDay(di, (d) => ({ ...d, exercises: [...(d.exercises ?? []), emptyExercise()] }))} className="mt-3 flex items-center gap-1 text-xs text-accent"><Plus size={13} /> Agregar ejercicio</button>
          </div>
        ))}
        <button type="button" onClick={() => setDraft({ ...draft, days: [...draft.days, emptyDay()] })} className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-accent/30 px-4 py-3 text-sm text-accent hover:bg-accent/[0.05]"><Plus size={15} /> Agregar día</button>
      </div>
      <label><span className={labelClass}>Notas generales</span><textarea rows="3" className={inputClass} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></label>
      <button disabled={busy} className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Guardando…' : submitLabel}</button>
    </form>
  )
}
