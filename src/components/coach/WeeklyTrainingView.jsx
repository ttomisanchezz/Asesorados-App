import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Dumbbell } from 'lucide-react'
import { getWorkoutHistory } from '../../services/workoutLogService'
import { buildTrainingWeek, trainingWeekKeys } from '../../lib/weeklyTraining'
import { formatWeekRange, localDateKey, weekDays } from '../../lib/week'
import SectionCard from '../ui/SectionCard'

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const STATUS = {
  improved: ['Mejoró', 'bg-emerald-500/10 text-emerald-400'],
  maintained: ['Mantuvo', 'bg-sky-500/10 text-sky-400'],
  declined: ['Bajó', 'bg-rose-500/10 text-rose-400'],
  no_previous: ['Sin referencia', 'bg-white/[0.04] text-slate-500'],
}

export default function WeeklyTrainingView({ clientId }) {
  const [history, setHistory] = useState(undefined)
  const [selectedWeek, setSelectedWeek] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    getWorkoutHistory(clientId).then(({ data, error: loadError }) => {
      if (!active) return
      const value = data ?? { sessions: [], exercises: [] }
      setHistory(value)
      setSelectedWeek(trainingWeekKeys(value).at(-1))
      if (loadError) setError(loadError.message || 'No se pudo cargar el historial.')
    })
    return () => { active = false }
  }, [clientId])
  const keys = useMemo(() => history ? trainingWeekKeys(history) : [], [history])
  const week = useMemo(() => history && selectedWeek ? buildTrainingWeek(history, selectedWeek) : null, [history, selectedWeek])
  const calendar = selectedWeek ? weekDays(selectedWeek) : []

  return (
    <SectionCard title="Rendimiento semanal" subtitle="Comparación determinística contra la semana calendario anterior">
      {history === undefined ? <p className="py-6 text-center text-sm text-slate-500">Cargando entrenamientos…</p> : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2 text-sm text-slate-300"><CalendarDays size={16} className="text-accent" />{formatWeekRange(selectedWeek)}</div><select value={selectedWeek || ''} onChange={(e) => setSelectedWeek(e.target.value)} className="rounded-xl border border-white/[0.08] bg-[#0d0d13] px-3 py-2 text-sm text-white outline-none">{[...keys].reverse().map((key) => <option key={key} value={key}>{formatWeekRange(key)}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[['Sesiones', week.summary.sessions], ['Series', week.summary.totalSets], ['Volumen', `${week.summary.totalVolume} kg`], ['Mejoraron', week.summary.improved]].map(([label, value]) => <div key={label} className="rounded-xl bg-white/[0.025] p-3"><div className="text-lg font-bold text-white">{value}</div><div className="text-[11px] text-slate-500">{label}</div></div>)}</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">{calendar.map((day, index) => { const sessions = week.sessions.filter((session) => localDateKey(session.date) === day.key); return <div key={day.key} className="min-h-20 rounded-xl border border-white/[0.06] bg-black/15 p-3"><div className="mb-2 text-xs font-semibold text-white">{DAY_LABELS[index]} {day.date.getDate()}</div>{sessions.length ? sessions.map((session) => <div key={session.id} className="mb-1 rounded-lg bg-accent/[0.07] p-2 text-[10px] text-slate-300"><Dumbbell size={11} className="mb-1 text-accent" />{session.dayName || session.dayKey || 'Entrenamiento'}<div className="text-slate-600">{session.totalSets} series</div></div>) : <span className="text-[10px] text-slate-600">Sin sesión</span>}</div> })}</div>
          {week.exercises.length === 0 ? <p className="py-3 text-center text-sm text-slate-500">No hay ejercicios registrados en esta semana.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead className="text-slate-600"><tr><th className="pb-2">Ejercicio</th><th className="pb-2">Mejor serie</th><th className="pb-2">e1RM</th><th className="pb-2">Semana anterior</th><th className="pb-2">Volumen</th><th className="pb-2">Resultado</th></tr></thead><tbody>{week.exercises.map((exercise) => { const [label, cls] = STATUS[exercise.status]; return <tr key={exercise.name} className="border-t border-white/[0.05]"><td className="py-3 font-medium text-white">{exercise.name}</td><td className="py-3 text-slate-300">{exercise.bestSet ? `${exercise.bestSet.weight} kg × ${exercise.bestSet.reps}${exercise.bestSet.rir != null ? ` · RIR ${exercise.bestSet.rir}` : ''}` : '—'}</td><td className="py-3 text-slate-300">{exercise.est1rm != null ? `${exercise.est1rm} kg` : '—'}</td><td className="py-3 text-slate-500">{exercise.previous?.est1rm != null ? `${exercise.previous.est1rm} kg e1RM` : 'Sin dato'}</td><td className="py-3 text-slate-500">{exercise.volume} kg</td><td className="py-3"><span className={`rounded-lg px-2 py-1 text-[10px] font-semibold ${cls}`}>{label}</span></td></tr> })}</tbody></table></div>}
          <p className="text-[11px] leading-relaxed text-slate-600">El estado usa e1RM estimado cuando hay peso y repeticiones; si no, compara carga y luego repeticiones. El volumen se muestra como dato informativo.</p>
          {error && <p className="text-sm text-rose-300">{error}</p>}
        </div>
      )}
    </SectionCard>
  )
}
