import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Utensils, Users, ArrowRight, Pencil, Plus, History } from 'lucide-react'
import Layout from '../components/layout/Layout'
import PageHeader from '../components/ui/PageHeader'
import SectionCard from '../components/ui/SectionCard'
import ProgressBar from '../components/ui/ProgressBar'
import EmptyState from '../components/ui/EmptyState'
import ClientPicker from '../components/ui/ClientPicker'
import Button from '../components/ui/Button'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { getClients } from '../services/clientService'
import {
  createNutritionPlanVersion, getNutritionPlan, getNutritionPlanHistory, updateNutritionPlanVersion,
} from '../services/nutritionService'
import { normalizeMealPlan, getActiveMacroTarget } from '../lib/mealPlan'
import Modal from '../components/coach/Modal'
import NutritionPlanEditor from '../components/coach/NutritionPlanEditor'
import WeeklyNutritionView from '../components/coach/WeeklyNutritionView'

export default function Nutrition() {
  const navigate = useNavigate()
  const [clients, setClients] = useState(null) // null = loading
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
    Promise.all([getNutritionPlan(selected), getNutritionPlanHistory(selected)])
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
      ? await createNutritionPlanVersion(selected, payload)
      : await updateNutritionPlanVersion(editor.plan.id, payload)
    setSaving(false)
    if (result.error) return setSaveError(result.error.message || 'No se pudo guardar el plan.')
    const [activeResult, historyResult] = await Promise.all([getNutritionPlan(selected), getNutritionPlanHistory(selected)])
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

  const client = clients?.find((c) => c.id === selected)
  const mealPlan = plan ? normalizeMealPlan(plan) : null
  const activeTarget = mealPlan ? getActiveMacroTarget(mealPlan) : null
  const targetCalories = activeTarget?.calories ?? plan?.calories
  const targetProtein = activeTarget?.protein ?? plan?.protein
  const targetCarbs = activeTarget?.carbs ?? plan?.carbs
  const targetFat = activeTarget?.fats ?? plan?.fat

  return (
    <Layout>
      <PageHeader title="Nutrición" subtitle="Plan activo, historial y seguimiento real">
        {selected && <Button icon={Plus} onClick={() => setEditor({ mode: 'new', plan: plan || {} })}>Nueva versión</Button>}
      </PageHeader>

      {clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No hay asesorados cargados"
          description="Cuando cargues asesorados vas a poder revisar sus planes nutricionales acá."
        />
      ) : (
        <>
          <ClientPicker clients={clients} selectedId={selected} onSelect={setSelected} />
          {selected && <div className="mb-4"><WeeklyNutritionView key={selected} clientId={selected} /></div>}

          {plan && (
            <div className="mb-4 flex flex-wrap gap-2">
              <Button variant="secondary" icon={Pencil} onClick={() => setEditor({ mode: 'edit', plan })}>Editar plan activo</Button>
              <Button variant="ghost" icon={ArrowRight} onClick={() => navigate(`/clients/${selected}`)}>Ver ficha completa</Button>
            </div>
          )}

          {planLoading ? (
            <PageLoader label="Cargando plan..." />
          ) : !plan ? (
            <EmptyState
              icon={Utensils}
              title={`${client?.name?.split(' ')[0] || 'Este asesorado'} todavía no tiene plan nutricional`}
              description="Creá la primera versión del plan desde este panel."
              action={
                <Button size="sm" icon={Plus} onClick={() => setEditor({ mode: 'new', plan: {} })}>Crear plan</Button>
              }
            />
          ) : (
            <div className="grid lg:grid-cols-3 gap-4">
              {/* Macro overview */}
              <SectionCard
                title="Objetivo calórico"
                subtitle={plan.lastUpdate ? `Actualizado: ${new Date(plan.lastUpdate).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}` : undefined}
              >
                <div className="text-center py-4">
                  <div className="text-5xl font-bold text-white mb-1">{targetCalories ?? '—'}</div>
                  <div className="text-slate-500 text-sm">kcal / día</div>
                </div>
                <div className="flex flex-col gap-3 mt-2">
                  {[
                    { label: 'Proteina', value: targetProtein, max: 250, color: 'accent' },
                    { label: 'Carbohidratos', value: targetCarbs, max: 450, color: 'sky' },
                    { label: 'Grasas', value: targetFat, max: 120, color: 'amber' },
                  ].map((m) => m.value != null ? (
                    <ProgressBar key={m.label} label={`${m.label} — ${m.value}g`} value={m.value} max={m.max} color={m.color} />
                  ) : (
                    <div key={m.label} className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">{m.label}</span>
                      <span className="text-slate-600">Sin cargar</span>
                    </div>
                  ))}
                </div>
                {activeTarget?.label && (
                  <div className="mt-3 rounded-xl bg-white/[0.02] border border-white/[0.06] px-3 py-2.5 text-center text-xs text-slate-400">
                    Objetivo de hoy: <span className="text-white">{activeTarget.label}</span>
                  </div>
                )}
                {plan.objective && (
                  <div className="mt-4 rounded-xl bg-accent/5 border border-accent/15 px-3 py-2.5 text-center text-xs text-accent">
                    {plan.objective}
                  </div>
                )}
              </SectionCard>

              {/* Meals */}
              <SectionCard title="Plan de comidas" className="lg:col-span-2">
                {mealPlan.type === 'empty' && (
                  <p className="py-6 text-center text-sm text-slate-500">
                    El detalle de comidas todavía no está cargado para este plan.
                  </p>
                )}
                {mealPlan.type === 'plain' && (
                  <div className="whitespace-pre-line rounded-xl bg-white/[0.02] p-4 text-sm leading-relaxed text-slate-300">
                    {mealPlan.text}
                  </div>
                )}
                {(mealPlan.type === 'grouped' || mealPlan.type === 'daily') && (
                  <div className="flex flex-col gap-3">
                    {mealPlan.schemes.map((scheme, si) => (
                      <div key={si} className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
                        {scheme.scheme && (
                          <div className="mb-2 text-sm font-semibold text-accent">{scheme.scheme}</div>
                        )}
                        <div className="flex flex-col gap-2.5">
                          {scheme.meals.map((meal, mi) => (
                            <div key={mi} className="flex items-start gap-3 border-b border-white/[0.04] pb-2.5 last:border-0 last:pb-0">
                              <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                                <Utensils size={13} className="text-accent" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-medium text-white">{meal.name}</span>
                                  <span className="shrink-0 text-xs text-slate-500">
                                    {meal.options.length} {meal.options.length === 1 ? 'opción' : 'opciones'}
                                  </span>
                                </div>
                                <div className="mt-0.5 text-xs leading-relaxed text-slate-500">
                                  {meal.options.map((o) => o.title).filter(Boolean).join(' · ')}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {plan.notes && (
                  <p className="mt-3 rounded-xl bg-white/[0.02] p-3 text-xs leading-relaxed text-slate-400 whitespace-pre-line">
                    {plan.notes.length > 300 ? plan.notes.slice(0, 300) + '…' : plan.notes}
                  </p>
                )}
              </SectionCard>
            </div>
          )}

          {!planLoading && history.length > 0 && (
            <div className="mt-4">
              <SectionCard title="Historial de versiones" subtitle="Editar una versión anterior no la reactiva" action={<History size={16} className="text-slate-500" />}>
                <div className="flex flex-col gap-2">
                  {history.map((version, index) => (
                    <div key={version.id || index} className="flex flex-col gap-2 rounded-xl bg-white/[0.025] p-3 sm:flex-row sm:items-center">
                      <div className="flex-1"><div className="text-sm font-medium text-white">{version.title || `Plan ${history.length - index}`}</div><div className="text-xs text-slate-500">{version.createdAt ? new Date(version.createdAt).toLocaleDateString('es-AR') : 'Sin fecha'} · {version.calories ?? '—'} kcal</div></div>
                      {version.active && <span className="rounded-lg bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-400">ACTIVO</span>}
                      <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setEditor({ mode: 'edit', plan: version })}>Editar</Button>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          )}
        </>
      )}

      <Modal open={Boolean(editor)} onClose={() => { setEditor(null); setSaveError('') }} title={editor?.mode === 'new' ? 'Nueva versión nutricional' : 'Editar versión nutricional'} subtitle={editor?.mode === 'new' ? 'Al guardar, reemplazará al plan activo.' : editor?.plan?.active ? 'Estás editando el plan activo.' : 'Esta versión histórica seguirá inactiva.'}>
        {editor && <NutritionPlanEditor key={`${editor.mode}-${editor.plan?.id || 'new'}`} initialPlan={editor.plan} onSubmit={savePlan} busy={saving} submitLabel={editor.mode === 'new' ? 'Crear y activar versión' : 'Guardar cambios'} />}
        {saveError && <p className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-3 text-sm text-rose-300">{saveError}</p>}
      </Modal>
    </Layout>
  )
}
