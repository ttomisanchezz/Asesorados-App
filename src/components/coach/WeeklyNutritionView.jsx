import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, CircleDashed, NotebookPen } from 'lucide-react'
import { getClientNutritionActivity } from '../../services/nutritionService'
import { buildNutritionWeek, nutritionWeekKeys } from '../../lib/weeklyNutrition'
import { addDaysKey, formatWeekRange } from '../../lib/week'
import SectionCard from '../ui/SectionCard'

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const STATE = {
  planned: { label: 'Según plan', cls: 'text-emerald-400 bg-emerald-500/10', Icon: CheckCircle2 },
  free: { label: 'Registro libre', cls: 'text-amber-400 bg-amber-500/10', Icon: NotebookPen },
  missing: { label: 'Sin registrar', cls: 'text-slate-600 bg-white/[0.03]', Icon: CircleDashed },
}

export default function WeeklyNutritionView({ clientId }) {
  const [dataset, setDataset] = useState(null)
  const [selectedWeek, setSelectedWeek] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getClientNutritionActivity(clientId).then(({ data, error: loadError }) => {
      if (!active) return
      setDataset(data)
      const keys = nutritionWeekKeys(data ?? {})
      setSelectedWeek(keys.at(-1))
      if (loadError) setError(loadError.message || 'No se pudo cargar la actividad nutricional.')
    })
    return () => { active = false }
  }, [clientId])

  const keys = useMemo(() => dataset ? nutritionWeekKeys(dataset) : [], [dataset])
  const current = useMemo(() => selectedWeek && dataset ? buildNutritionWeek({ ...dataset, weekKey: selectedWeek }) : null, [dataset, selectedWeek])
  const previous = useMemo(() => selectedWeek && dataset ? buildNutritionWeek({ ...dataset, weekKey: addDaysKey(selectedWeek, -7) }) : null, [dataset, selectedWeek])
  const adherenceDelta = current?.summary.adherence != null && previous?.summary.adherence != null
    ? current.summary.adherence - previous.summary.adherence : null

  return (
    <SectionCard title="Seguimiento semanal" subtitle="Lunes a domingo · plan vigente en cada fecha">
      {!dataset ? <p className="py-6 text-center text-sm text-slate-500">Cargando seguimiento…</p> : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-300"><CalendarDays size={16} className="text-accent" />{formatWeekRange(selectedWeek)}</div>
            <select value={selectedWeek || ''} onChange={(e) => setSelectedWeek(e.target.value)} className="rounded-xl border border-white/[0.08] bg-[#0d0d13] px-3 py-2 text-sm text-white outline-none">
              {[...keys].reverse().map((key) => <option key={key} value={key}>{formatWeekRange(key)}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['Adherencia', current.summary.adherence == null ? '—' : `${current.summary.adherence}%`],
              ['Comidas del plan', `${current.summary.fulfilled}/${current.summary.planned}`],
              ['Fuera del plan', current.summary.outsidePlan],
              ['Vs. semana anterior', adherenceDelta == null ? 'Sin comparación' : `${adherenceDelta > 0 ? '+' : ''}${adherenceDelta} pt`],
            ].map(([label, value]) => <div key={label} className="rounded-xl bg-white/[0.025] p-3"><div className="text-lg font-bold text-white">{value}</div><div className="mt-0.5 text-[11px] text-slate-500">{label}</div></div>)}
          </div>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-7">
            {current.days.map((day, index) => (
              <div key={day.key} className="rounded-xl border border-white/[0.06] bg-black/15 p-3">
                <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold text-white">{DAY_LABELS[index]} {day.date.getDate()}</span><span className="text-[10px] text-slate-600">{day.fulfilled}/{day.planned}</span></div>
                <div className="flex flex-col gap-2">
                  {day.meals.length === 0 && day.extraLogs.length === 0 && <p className="text-[11px] text-slate-600">Sin plan ni registros.</p>}
                  {day.meals.map((meal) => {
                    const meta = STATE[meal.state]
                    return <div key={meal.key} className="rounded-lg bg-white/[0.025] p-2"><div className="flex items-start gap-1.5"><meta.Icon size={12} className={meta.cls.split(' ')[0]} /><div className="min-w-0"><div className="truncate text-[11px] font-medium text-slate-300">{meal.mealName}</div><span className={`mt-1 inline-flex rounded px-1.5 py-0.5 text-[9px] ${meta.cls}`}>{meta.label}</span></div></div>{meal.option && <div className="mt-1.5 text-[10px] leading-relaxed text-slate-500"><span className="text-slate-400">{meal.option.title}</span>{meal.option.items?.length ? ` · ${meal.option.items.join(' · ')}` : ''}</div>}{meal.logs.map((log) => <div key={log.id} className="mt-1 text-[10px] text-slate-500">{log.description}</div>)}</div>
                  })}
                  {day.extraLogs.map((log) => <div key={log.id} className="rounded-lg bg-amber-500/[0.06] p-2 text-[10px] text-amber-300">Libre: {log.meal_label ? `${log.meal_label} · ` : ''}{log.description}</div>)}
                </div>
              </div>
            ))}
          </div>
          {error && <p className="text-sm text-rose-300">{error}</p>}
        </div>
      )}
    </SectionCard>
  )
}
