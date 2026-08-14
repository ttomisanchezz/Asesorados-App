import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

const inputClass = 'w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-accent/50'
const labelClass = 'mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500'
const number = (value) => value === '' || value == null ? null : Number(value)

const emptyOption = () => ({ title: '', items: [], kcal: '', macros: { p: '', c: '', f: '' } })
const emptyMeal = () => ({ name: '', options: [emptyOption()] })
const emptyScheme = () => ({
  scheme: '', description: '',
  target: { type: '', calories: '', protein: '', carbs: '', fats: '' },
  meals: [emptyMeal()],
})

function initialDraft(plan = {}) {
  let mode = typeof plan.meals === 'string' ? 'plain' : 'structured'
  let plain = mode === 'plain' ? plan.meals : ''
  let schemes = []
  if (Array.isArray(plan.meals) && plan.meals.some((item) => Array.isArray(item?.meals))) {
    schemes = structuredClone(plan.meals)
  } else if (Array.isArray(plan.meals) && plan.meals.length) {
    schemes = [{
      ...emptyScheme(),
      meals: plan.meals.map((meal) => ({
        name: meal.name || '',
        options: [{ ...emptyOption(), title: meal.description || meal.name || '', kcal: meal.calories ?? '', items: meal.items ?? [] }],
      })),
    }]
  }
  if (mode === 'structured' && !schemes.length) schemes = [emptyScheme()]
  return {
    title: plan.title || '', calories: plan.calories ?? '', protein: plan.protein ?? '',
    carbs: plan.carbs ?? '', fat: plan.fat ?? plan.fats ?? '', notes: plan.notes || '',
    mode, plain, schemes,
  }
}
function Field({ label, ...props }) {
  return <label><span className={labelClass}>{label}</span><input className={inputClass} {...props} /></label>
}

export default function NutritionPlanEditor({ initialPlan, onSubmit, submitLabel = 'Guardar', busy = false }) {
  const [draft, setDraft] = useState(() => initialDraft(initialPlan))
  const changeScheme = (si, updater) => setDraft((old) => ({
    ...old, schemes: old.schemes.map((scheme, index) => index === si ? updater(scheme) : scheme),
  }))
  const submit = (event) => {
    event.preventDefault()
    const meals = draft.mode === 'plain' ? draft.plain : draft.schemes.map((scheme) => ({
      ...scheme,
      target: {
        ...scheme.target,
        calories: number(scheme.target?.calories), protein: number(scheme.target?.protein),
        carbs: number(scheme.target?.carbs), fats: number(scheme.target?.fats),
      },
      meals: (scheme.meals ?? []).map((meal) => ({
        ...meal,
        options: (meal.options ?? []).map((option) => ({
          ...option,
          items: Array.isArray(option.items) ? option.items.filter(Boolean) : [],
          kcal: number(option.kcal),
          macros: { p: number(option.macros?.p), c: number(option.macros?.c), f: number(option.macros?.f) },
        })),
      })),
    }))
    onSubmit({
      title: draft.title, calories: number(draft.calories), protein: number(draft.protein),
      carbs: number(draft.carbs), fat: number(draft.fat), notes: draft.notes, meals,
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-5">
        <div className="sm:col-span-5"><Field label="Nombre de la versión" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Plan agosto" /></div>
        <Field label="Kcal" type="number" min="0" value={draft.calories} onChange={(e) => setDraft({ ...draft, calories: e.target.value })} />
        <Field label="Proteína (g)" type="number" min="0" value={draft.protein} onChange={(e) => setDraft({ ...draft, protein: e.target.value })} />
        <Field label="Carbohidratos (g)" type="number" min="0" value={draft.carbs} onChange={(e) => setDraft({ ...draft, carbs: e.target.value })} />
        <Field label="Grasas (g)" type="number" min="0" value={draft.fat} onChange={(e) => setDraft({ ...draft, fat: e.target.value })} />
        <label><span className={labelClass}>Formato</span><select className={inputClass} value={draft.mode} onChange={(e) => setDraft({ ...draft, mode: e.target.value })}><option value="structured">Estructurado</option><option value="plain">Texto libre</option></select></label>
      </div>

      {draft.mode === 'plain' ? (
        <label><span className={labelClass}>Plan en texto libre</span><textarea rows="10" className={inputClass} value={draft.plain} onChange={(e) => setDraft({ ...draft, plain: e.target.value })} /></label>
      ) : (
        <div className="flex flex-col gap-4">
          {draft.schemes.map((scheme, si) => (
            <div key={si} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-accent">Día o esquema {si + 1}</span>
                <button type="button" onClick={() => setDraft({ ...draft, schemes: draft.schemes.filter((_, i) => i !== si) })} className="text-slate-600 hover:text-rose-400" aria-label="Eliminar esquema"><Trash2 size={15} /></button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nombre (ej. Lunes/Descanso)" value={scheme.scheme || ''} onChange={(e) => changeScheme(si, (s) => ({ ...s, scheme: e.target.value }))} />
                <Field label="Descripción" value={scheme.description || ''} onChange={(e) => changeScheme(si, (s) => ({ ...s, description: e.target.value }))} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {[
                  ['type', 'Tipo'], ['calories', 'Kcal'], ['protein', 'Prot.'], ['carbs', 'Carbs'], ['fats', 'Grasas'],
                ].map(([key, label]) => <Field key={key} label={`Objetivo ${label}`} type={key === 'type' ? 'text' : 'number'} min="0" value={scheme.target?.[key] ?? ''} onChange={(e) => changeScheme(si, (s) => ({ ...s, target: { ...s.target, [key]: e.target.value } }))} />)}
              </div>

              <div className="mt-4 flex flex-col gap-3">
                {(scheme.meals ?? []).map((meal, mi) => (
                  <div key={mi} className="rounded-xl border border-white/[0.06] bg-black/15 p-3">
                    <div className="flex items-end gap-2">
                      <div className="flex-1"><Field label={`Comida ${mi + 1}`} value={meal.name || ''} onChange={(e) => changeScheme(si, (s) => ({ ...s, meals: s.meals.map((m, i) => i === mi ? { ...m, name: e.target.value } : m) }))} /></div>
                      <button type="button" onClick={() => changeScheme(si, (s) => ({ ...s, meals: s.meals.filter((_, i) => i !== mi) }))} className="mb-2 text-slate-600 hover:text-rose-400"><Trash2 size={15} /></button>
                    </div>
                    <div className="mt-3 flex flex-col gap-2">
                      {(meal.options ?? []).map((option, oi) => {
                        const updateOption = (next) => changeScheme(si, (s) => ({ ...s, meals: s.meals.map((m, i) => i === mi ? { ...m, options: m.options.map((o, j) => j === oi ? next(o) : o) } : m) }))
                        return (
                          <div key={oi} className="grid gap-2 rounded-xl bg-white/[0.025] p-3 sm:grid-cols-6">
                            <div className="sm:col-span-2"><Field label={`Opción ${oi + 1}`} value={option.title || ''} onChange={(e) => updateOption((o) => ({ ...o, title: e.target.value }))} /></div>
                            <Field label="Kcal" type="number" value={option.kcal ?? ''} onChange={(e) => updateOption((o) => ({ ...o, kcal: e.target.value }))} />
                            {['p', 'c', 'f'].map((key) => <Field key={key} label={key.toUpperCase()} type="number" value={option.macros?.[key] ?? ''} onChange={(e) => updateOption((o) => ({ ...o, macros: { ...o.macros, [key]: e.target.value } }))} />)}
                            <label className="sm:col-span-5"><span className={labelClass}>Alimentos (uno por línea)</span><textarea rows="3" className={inputClass} value={(option.items ?? []).join('\n')} onChange={(e) => updateOption((o) => ({ ...o, items: e.target.value.split('\n') }))} /></label>
                            <button type="button" onClick={() => changeScheme(si, (s) => ({ ...s, meals: s.meals.map((m, i) => i === mi ? { ...m, options: m.options.filter((_, j) => j !== oi) } : m) }))} className="self-center justify-self-center text-slate-600 hover:text-rose-400"><Trash2 size={15} /></button>
                          </div>
                        )
                      })}
                    </div>
                    <button type="button" onClick={() => changeScheme(si, (s) => ({ ...s, meals: s.meals.map((m, i) => i === mi ? { ...m, options: [...m.options, emptyOption()] } : m) }))} className="mt-2 flex items-center gap-1 text-xs text-accent"><Plus size={13} /> Agregar opción</button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => changeScheme(si, (s) => ({ ...s, meals: [...(s.meals ?? []), emptyMeal()] }))} className="mt-3 flex items-center gap-1 text-xs text-accent"><Plus size={13} /> Agregar comida</button>
            </div>
          ))}
          <button type="button" onClick={() => setDraft({ ...draft, schemes: [...draft.schemes, emptyScheme()] })} className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-accent/30 px-4 py-3 text-sm text-accent hover:bg-accent/[0.05]"><Plus size={15} /> Agregar día o esquema</button>
        </div>
      )}

      <label><span className={labelClass}>Notas</span><textarea rows="3" className={inputClass} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></label>
      <button disabled={busy} className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Guardando…' : submitLabel}</button>
    </form>
  )
}
