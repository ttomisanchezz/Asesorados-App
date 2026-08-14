import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dumbbell, Users, ArrowRight, Pencil, Plus, History } from 'lucide-react'
import Layout from '../components/layout/Layout'
import PageHeader from '../components/ui/PageHeader'
import SectionCard from '../components/ui/SectionCard'
import EmptyState from '../components/ui/EmptyState'
import ClientPicker from '../components/ui/ClientPicker'
import Button from '../components/ui/Button'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { getClients } from '../services/clientService'
import {
  createWorkoutPlanVersion, getWorkoutPlan, getWorkoutPlanHistory, updateWorkoutPlanVersion,
} from '../services/workoutService'
import Modal from '../components/coach/Modal'
import WorkoutPlanEditor from '../components/coach/WorkoutPlanEditor'
import WeeklyTrainingView from '../components/coach/WeeklyTrainingView'

export default function Training() {
  const navigate = useNavigate()
  const [clients, setClients] = useState(null)
  const [selected, setSelected] = useState(null)
  // { id, data } — el loading se deriva comparando id con selected (sin setState sync).
  const [planRes, setPlanRes] = useState(null)
  const [historyRes, setHistoryRes] = useState(null)
  const [editor, setEditor] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    let active = true
    getClients()
      .then(({ data }) => {
        if (!active) return
        const list = data ?? []
        setClients(list)
        const first = list.find((c) => c.status === 'active') ?? list[0]
        if (first) setSelected(first.id)
      })
      .catch(() => { if (active) setClients([]) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!selected) return
    let active = true
    Promise.all([getWorkoutPlan(selected), getWorkoutPlanHistory(selected)])
      .then(([planResult, historyResult]) => {
        if (!active) return
        setPlanRes({ id: selected, data: planResult.data ?? null })
        setHistoryRes({ id: selected, data: historyResult.data ?? [] })
      })
      .catch(() => { if (active) setPlanRes({ id: selected, data: null }) })
    return () => { active = false }
  }, [selected])

  const planLoading = selected != null && planRes?.id !== selected
  const plan = planRes?.id === selected ? planRes.data : null
  const history = historyRes?.id === selected ? historyRes.data : []

  const savePlan = async (payload) => {
    setSaving(true); setSaveError('')
    const result = editor.mode === 'new'
      ? await createWorkoutPlanVersion(selected, payload)
      : await updateWorkoutPlanVersion(editor.plan.id, payload)
    setSaving(false)
    if (result.error) return setSaveError(result.error.message || 'No se pudo guardar la rutina.')
    const [activeResult, historyResult] = await Promise.all([getWorkoutPlan(selected), getWorkoutPlanHistory(selected)])
    setPlanRes({ id: selected, data: activeResult.data ?? null })
    setHistoryRes({ id: selected, data: historyResult.data ?? [] })
    setEditor(null)
  }

  if (clients === null) {
    return (
      <Layout>
        <PageLoader label="Cargando asesorados..." />
      </Layout>
    )
  }

  const client = clients.find((c) => c.id === selected)
  // Datos reales: los ejercicios viven anidados en days[].exercises.
  const days = Array.isArray(plan?.days) ? plan.days : []
  const totalExercises = days.reduce((sum, d) => sum + (d.exercises?.length ?? 0), 0)

  return (
    <Layout>
      <PageHeader title="Entrenamiento" subtitle="Rutina, historial y rendimiento real">
        {selected && <Button icon={Plus} onClick={() => setEditor({ mode: 'new', plan: plan || {} })}>Nueva versión</Button>}
      </PageHeader>

      {clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No hay asesorados cargados"
          description="Cuando cargues asesorados vas a poder revisar sus rutinas acá."
        />
      ) : (
        <>
          <ClientPicker clients={clients} selectedId={selected} onSelect={setSelected} />
          {selected && <div className="mb-4"><WeeklyTrainingView key={selected} clientId={selected} /></div>}

          {plan && <div className="mb-4 flex flex-wrap gap-2"><Button variant="secondary" icon={Pencil} onClick={() => setEditor({ mode: 'edit', plan })}>Editar rutina activa</Button><Button variant="ghost" icon={ArrowRight} onClick={() => navigate(`/clients/${selected}`)}>Ver ficha completa</Button></div>}

          {planLoading ? (
            <PageLoader label="Cargando rutina..." />
          ) : !plan ? (
            <EmptyState
              icon={Dumbbell}
              title={`${client?.name?.split(' ')[0] || 'Este asesorado'} todavía no tiene rutina activa`}
              description="Creá la primera versión de la rutina desde este panel."
              action={
                <Button size="sm" icon={Plus} onClick={() => setEditor({ mode: 'new', plan: {} })}>Crear rutina</Button>
              }
            />
          ) : (
            <div className="flex flex-col gap-4">
              {/* Plan info */}
              <SectionCard title="Plan activo">
                <div className="p-4 bg-accent/[0.08] border border-accent/15 rounded-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <Dumbbell size={16} className="text-accent" />
                    <span className="text-accent font-semibold text-sm">{plan.plan || 'Rutina sin título'}</span>
                  </div>
                  <div className="text-slate-500 text-xs">
                    {days.length > 0 ? `${days.length} días por semana · ${totalExercises} ejercicios` : 'Sin días cargados'}
                  </div>
                  {plan.notes && (
                    <p className="mt-2 text-xs leading-relaxed text-slate-400">{plan.notes}</p>
                  )}
                </div>
              </SectionCard>

              {/* Días con ejercicios */}
              {days.length === 0 ? (
                <SectionCard title="Días de entrenamiento">
                  <p className="py-4 text-center text-sm text-slate-500">La rutina no tiene días cargados todavía.</p>
                </SectionCard>
              ) : (
                <div className="grid lg:grid-cols-2 gap-4">
                  {days.map((day, di) => (
                    <SectionCard
                      key={di}
                      title={day.focus || `Día ${di + 1}`}
                      subtitle={day.day}
                      action={
                        <span className="text-xs text-slate-500">{day.exercises?.length ?? 0} ejercicios</span>
                      }
                    >
                      {(day.exercises?.length ?? 0) === 0 ? (
                        <p className="text-xs text-slate-600 py-2">Sin ejercicios cargados.</p>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {day.exercises.map((ex, i) => (
                            <div key={i} className="flex items-start gap-3 p-3 bg-white/[0.02] rounded-xl">
                              <div className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center text-slate-500 shrink-0 font-semibold text-[10px] mt-0.5">
                                {i + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-white text-sm font-medium leading-snug">{ex.name}</div>
                                {ex.notes && <div className="text-slate-500 text-xs mt-0.5">{ex.notes}</div>}
                              </div>
                              <div className="flex flex-col items-end gap-0.5 shrink-0 text-right">
                                {ex.sets && <span className="text-xs font-semibold text-accent">{ex.sets} series</span>}
                                {ex.reps != null && ex.reps !== '' && <span className="text-xs text-slate-300">{ex.reps} reps</span>}
                                {ex.rir != null && ex.rir !== '' && <span className="text-[10px] text-slate-600">RIR {ex.rir}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </SectionCard>
                  ))}
                </div>
              )}
            </div>
          )}

          {!planLoading && history.length > 0 && (
            <div className="mt-4"><SectionCard title="Historial de versiones" subtitle="Editar una versión anterior no la reactiva" action={<History size={16} className="text-slate-500" />}><div className="flex flex-col gap-2">{history.map((version, index) => <div key={version.id || index} className="flex flex-col gap-2 rounded-xl bg-white/[0.025] p-3 sm:flex-row sm:items-center"><div className="flex-1"><div className="text-sm font-medium text-white">{version.plan || `Rutina ${history.length - index}`}</div><div className="text-xs text-slate-500">{version.createdAt ? new Date(version.createdAt).toLocaleDateString('es-AR') : 'Sin fecha'} · {version.days?.length ?? 0} días</div></div>{version.active && <span className="rounded-lg bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-400">ACTIVA</span>}<Button variant="ghost" size="sm" icon={Pencil} onClick={() => setEditor({ mode: 'edit', plan: version })}>Editar</Button></div>)}</div></SectionCard></div>
          )}
        </>
      )}

      <Modal open={Boolean(editor)} onClose={() => { setEditor(null); setSaveError('') }} title={editor?.mode === 'new' ? 'Nueva versión de rutina' : 'Editar versión de rutina'} subtitle={editor?.mode === 'new' ? 'Al guardar, reemplazará a la rutina activa.' : editor?.plan?.active ? 'Estás editando la rutina activa.' : 'Esta versión histórica seguirá inactiva.'}>
        {editor && <WorkoutPlanEditor key={`${editor.mode}-${editor.plan?.id || 'new'}`} initialPlan={editor.plan} onSubmit={savePlan} busy={saving} submitLabel={editor.mode === 'new' ? 'Crear y activar versión' : 'Guardar cambios'} />}
        {saveError && <p className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-3 text-sm text-rose-300">{saveError}</p>}
      </Modal>
    </Layout>
  )
}
