import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, TrendingDown, Minus, Users } from 'lucide-react'
import Layout from '../components/layout/Layout'
import PageHeader from '../components/ui/PageHeader'
import SectionCard from '../components/ui/SectionCard'
import ProgressBar from '../components/ui/ProgressBar'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import ClientPicker from '../components/ui/ClientPicker'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { getClients } from '../services/clientService'
import { getProgressMetrics } from '../services/progressService'

export default function Progress() {
  const navigate = useNavigate()
  const [clients, setClients] = useState(null)
  const [selected, setSelected] = useState(null)
  // { id, data } — el loading se deriva comparando id con selected (sin setState sync).
  const [progressRes, setProgressRes] = useState(null)

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
    getProgressMetrics(selected)
      .then(({ data }) => { if (active) setProgressRes({ id: selected, data: data ?? null }) })
      .catch(() => { if (active) setProgressRes({ id: selected, data: null }) })
    return () => { active = false }
  }, [selected])

  const progLoading = selected != null && progressRes?.id !== selected
  const progress = progressRes?.id === selected ? progressRes.data : null

  if (clients === null) {
    return (
      <Layout>
        <PageLoader label="Cargando asesorados..." />
      </Layout>
    )
  }

  const client = clients.find((c) => c.id === selected)
  const history = progress?.weightHistory ?? []
  const initialW = history[0] ?? null
  const currentW = history.length ? history[history.length - 1] : (client?.weight ?? null)
  const weightChange = initialW != null && currentW != null
    ? Math.round((currentW - initialW) * 10) / 10
    : null
  const isLoss = weightChange != null && weightChange < 0
  const isGain = weightChange != null && weightChange > 0

  const measurements = progress?.measurements ?? {}
  const measureItems = [
    { label: 'Cintura', value: measurements.waist },
    { label: 'Pecho', value: measurements.chest },
    { label: 'Cadera', value: measurements.hip },
    { label: 'Brazo', value: measurements.arm },
    { label: 'Pierna', value: measurements.leg },
  ].filter((m) => m.value != null)

  return (
    <Layout>
      <PageHeader title="Progreso" subtitle="Evolución física y adherencia de cada asesorado" />

      {clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No hay asesorados cargados"
          description="Cuando cargues asesorados vas a poder seguir su progreso acá."
        />
      ) : (
        <>
          <ClientPicker clients={clients} selectedId={selected} onSelect={setSelected} />

          {progLoading ? (
            <PageLoader label="Cargando progreso..." />
          ) : (
            <div className="grid lg:grid-cols-3 gap-4">
              {/* Summary */}
              {client && (
                <SectionCard title="Resumen de progreso">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold shrink-0"
                        style={{ backgroundColor: (client.avatarColor || '#6c63ff') + '22', color: client.avatarColor || '#8b85ff' }}
                      >
                        {client.avatar}
                      </div>
                      <div>
                        <div className="text-white font-semibold">{client.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant={client.status} />
                          {client.objective && <span className="text-slate-500 text-xs">{client.objective}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                        <div className="text-slate-500 text-xs mb-1">Peso inicial</div>
                        <div className="text-white font-bold text-xl">{initialW ?? '—'}</div>
                        <div className="text-slate-600 text-xs">kg</div>
                      </div>
                      <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                        <div className="text-slate-500 text-xs mb-1">Peso actual</div>
                        <div className="text-white font-bold text-xl">{currentW ?? '—'}</div>
                        <div className="text-slate-600 text-xs">kg</div>
                      </div>
                      <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                        <div className="text-slate-500 text-xs mb-1">Objetivo</div>
                        <div className="text-accent font-bold text-xl">{client.targetWeight ?? '—'}</div>
                        <div className="text-slate-600 text-xs">kg</div>
                      </div>
                      <div className={`rounded-xl p-3 text-center ${isLoss ? 'bg-emerald-500/10' : isGain ? 'bg-amber-500/10' : 'bg-white/[0.03]'}`}>
                        <div className="text-slate-500 text-xs mb-1">Cambio total</div>
                        <div className={`font-bold text-xl flex items-center justify-center gap-1 ${isLoss ? 'text-emerald-400' : isGain ? 'text-amber-400' : 'text-white'}`}>
                          {isLoss ? <TrendingDown size={16} /> : isGain ? <TrendingUp size={16} /> : <Minus size={16} />}
                          {weightChange != null ? Math.abs(weightChange) : '—'}
                        </div>
                        <div className="text-slate-600 text-xs">kg</div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 pt-1">
                      <ProgressBar label={`Nutrición — ${client.adherenceNutrition ?? 0}%`} value={client.adherenceNutrition ?? 0} color="accent" />
                      <ProgressBar label={`Entrenamiento — ${client.adherenceTraining ?? 0}%`} value={client.adherenceTraining ?? 0} color="emerald" />
                    </div>
                  </div>
                </SectionCard>
              )}

              {/* Weight chart */}
              <SectionCard
                title="Evolución de peso"
                subtitle={history.length > 0 ? `${progress.count} registros` : undefined}
                className="lg:col-span-2"
              >
                {history.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">
                    Todavía no hay registros de peso. Cuando el asesorado cargue su peso, vas a ver la curva acá.
                  </p>
                ) : (
                  <>
                    <div className="flex items-end gap-2 h-40 mt-4">
                      {history.map((w, i) => {
                        const max = Math.max(...history)
                        const min = Math.min(...history) - 0.5
                        const range = max - min || 1
                        const heightPct = ((w - min) / range) * 70 + 20
                        const isLast = i === history.length - 1
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                            <span className="text-slate-400 text-[10px] font-semibold">{w}</span>
                            <div
                              className={`w-full rounded-t-lg transition-all ${isLast ? 'bg-accent' : 'bg-accent/40 hover:bg-accent/60'}`}
                              style={{ height: `${heightPct}%` }}
                            />
                            <span className="text-slate-600 text-[9px] text-center leading-tight truncate w-full">{progress.dates?.[i]}</span>
                          </div>
                        )
                      })}
                    </div>
                    {measureItems.length > 0 && (
                      <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2 pt-4 border-t border-white/[0.05]">
                        {measureItems.map((m) => (
                          <div key={m.label} className="rounded-xl bg-white/[0.02] p-3 text-center">
                            <div className="mb-0.5 text-xs text-slate-500">{m.label}</div>
                            <div className="font-bold text-white text-sm">{m.value} cm</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </SectionCard>

              {/* Global overview */}
              <SectionCard title="Comparativa general" subtitle="Todos los asesorados" className="lg:col-span-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left">
                        <th className="text-slate-500 text-xs font-medium pb-3 pr-4">Asesorado</th>
                        <th className="text-slate-500 text-xs font-medium pb-3 pr-4">Objetivo</th>
                        <th className="text-slate-500 text-xs font-medium pb-3 pr-4">Peso actual</th>
                        <th className="text-slate-500 text-xs font-medium pb-3 pr-4">Nut. %</th>
                        <th className="text-slate-500 text-xs font-medium pb-3 pr-4">Ent. %</th>
                        <th className="text-slate-500 text-xs font-medium pb-3">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clients.map((c) => (
                        <tr
                          key={c.id}
                          className="border-t border-white/[0.04] cursor-pointer hover:bg-white/[0.02] transition-colors"
                          onClick={() => navigate(`/clients/${c.id}`)}
                        >
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2.5">
                              <div
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-semibold shrink-0"
                                style={{ backgroundColor: (c.avatarColor || '#6c63ff') + '33', color: c.avatarColor || '#8b85ff' }}
                              >
                                {c.avatar}
                              </div>
                              <span className="text-white font-medium">{c.name}</span>
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-slate-400">{c.objective || '—'}</td>
                          <td className="py-3 pr-4 text-white font-semibold">{c.weight != null ? `${c.weight} kg` : '—'}</td>
                          <td className="py-3 pr-4">
                            <span className={(c.adherenceNutrition ?? 0) >= 85 ? 'text-emerald-400' : (c.adherenceNutrition ?? 0) >= 65 ? 'text-amber-400' : 'text-rose-400'}>
                              {c.adherenceNutrition ?? 0}%
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <span className={(c.adherenceTraining ?? 0) >= 85 ? 'text-emerald-400' : (c.adherenceTraining ?? 0) >= 65 ? 'text-amber-400' : 'text-rose-400'}>
                              {c.adherenceTraining ?? 0}%
                            </span>
                          </td>
                          <td className="py-3">
                            <Badge variant={c.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>
          )}
        </>
      )}
    </Layout>
  )
}
