import { useState } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import Layout from '../components/layout/Layout'
import PageHeader from '../components/ui/PageHeader'
import SectionCard from '../components/ui/SectionCard'
import ProgressBar from '../components/ui/ProgressBar'
import Badge from '../components/ui/Badge'
import { mockClients } from '../data/mockClients'

export default function Progress() {
  const [selected, setSelected] = useState(mockClients[0].id)
  const client = mockClients.find((c) => c.id === selected)

  const weightChange = client
    ? (client.progress.weightHistory[client.progress.weightHistory.length - 1] - client.progress.weightHistory[0]).toFixed(1)
    : 0

  const isLoss = parseFloat(weightChange) < 0
  const isGain = parseFloat(weightChange) > 0

  return (
    <Layout>
      <PageHeader title="Progreso" subtitle="Evolución física y adherencia de cada asesorado" />

      {/* Client selector */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
        {mockClients.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelected(c.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all shrink-0 ${
              selected === c.id
                ? 'bg-accent/15 text-accent border border-accent/25'
                : 'bg-[#111118] text-slate-400 border border-white/[0.06] hover:text-white'
            }`}
          >
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-semibold"
              style={{ backgroundColor: c.avatarColor + '33', color: c.avatarColor }}
            >
              {c.avatar}
            </div>
            {c.name.split(' ')[0]}
          </button>
        ))}
      </div>

      {client && (
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Summary */}
          <SectionCard title="Resumen de progreso">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ backgroundColor: client.avatarColor + '22', color: client.avatarColor }}
                >
                  {client.avatar}
                </div>
                <div>
                  <div className="text-white font-semibold">{client.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant={client.status} />
                    <span className="text-slate-500 text-xs">{client.objective}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                  <div className="text-slate-500 text-xs mb-1">Peso inicial</div>
                  <div className="text-white font-bold text-xl">{client.progress.weightHistory[0]}</div>
                  <div className="text-slate-600 text-xs">kg</div>
                </div>
                <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                  <div className="text-slate-500 text-xs mb-1">Peso actual</div>
                  <div className="text-white font-bold text-xl">{client.weight}</div>
                  <div className="text-slate-600 text-xs">kg</div>
                </div>
                <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                  <div className="text-slate-500 text-xs mb-1">Objetivo</div>
                  <div className="text-accent font-bold text-xl">{client.targetWeight}</div>
                  <div className="text-slate-600 text-xs">kg</div>
                </div>
                <div className={`rounded-xl p-3 text-center ${isLoss ? 'bg-emerald-500/10' : isGain ? 'bg-amber-500/10' : 'bg-white/[0.03]'}`}>
                  <div className="text-slate-500 text-xs mb-1">Cambio total</div>
                  <div className={`font-bold text-xl flex items-center justify-center gap-1 ${isLoss ? 'text-emerald-400' : isGain ? 'text-amber-400' : 'text-white'}`}>
                    {isLoss ? <TrendingDown size={16} /> : isGain ? <TrendingUp size={16} /> : <Minus size={16} />}
                    {Math.abs(weightChange)}
                  </div>
                  <div className="text-slate-600 text-xs">kg</div>
                </div>
              </div>

              <div>
                <div className="text-slate-500 text-xs mb-1">Progreso hacia objetivo</div>
                <ProgressBar
                  value={Math.abs(client.progress.weightHistory[0] - client.weight)}
                  max={Math.abs(client.progress.weightHistory[0] - client.targetWeight) || 1}
                  color={isLoss ? 'emerald' : 'accent'}
                />
              </div>
            </div>
          </SectionCard>

          {/* Weight chart */}
          <SectionCard title="Evolución de peso" subtitle="Historial completo" className="lg:col-span-2">
            <div className="flex items-end gap-2 h-40 mt-4">
              {client.progress.weightHistory.map((w, i) => {
                const max = Math.max(...client.progress.weightHistory)
                const min = Math.min(...client.progress.weightHistory) - 0.5
                const range = max - min || 1
                const heightPct = ((w - min) / range) * 70 + 20
                const isLast = i === client.progress.weightHistory.length - 1
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                    <span className="text-slate-400 text-[10px] font-semibold">{w}</span>
                    <div
                      className={`w-full rounded-t-lg transition-all ${isLast ? 'bg-accent' : 'bg-accent/40 hover:bg-accent/60'}`}
                      style={{ height: `${heightPct}%` }}
                    />
                    <span className="text-slate-600 text-[9px] text-center leading-tight">{client.progress.dates[i]}</span>
                  </div>
                )
              })}
            </div>
          </SectionCard>

          {/* Measurements */}
          <SectionCard title="Medidas corporales">
            <div className="flex flex-col gap-3">
              {[
                { label: 'Cintura', value: client.progress.measurements.waist, icon: '📏' },
                { label: 'Caderas', value: client.progress.measurements.hips, icon: '📐' },
                { label: 'Pecho', value: client.progress.measurements.chest, icon: '📏' },
              ].map((m) => (
                <div key={m.label} className="flex items-center justify-between p-3.5 bg-white/[0.02] rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">{m.icon}</span>
                    <span className="text-slate-300 text-sm">{m.label}</span>
                  </div>
                  <span className="text-white font-bold text-base">{m.value} cm</span>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Adherence */}
          <SectionCard title="Adherencia semanal" className="lg:col-span-2">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-3">
                <ProgressBar label={`Nutrición — ${client.adherenceNutrition}%`} value={client.adherenceNutrition} color="accent" />
                <ProgressBar label={`Entrenamiento — ${client.adherenceTraining}%`} value={client.adherenceTraining} color="emerald" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-white/[0.02] rounded-xl text-center">
                  <div className="text-slate-500 text-xs mb-1">Días de entreno</div>
                  <div className="text-white font-bold text-xl">{client.training.days.length}</div>
                  <div className="text-slate-600 text-xs">por semana</div>
                </div>
                <div className="p-3 bg-white/[0.02] rounded-xl text-center">
                  <div className="text-slate-500 text-xs mb-1">Objetivo</div>
                  <div className="text-accent font-bold text-sm">{client.weeklyGoal}</div>
                </div>
              </div>
            </div>
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
                  {mockClients.map((c) => (
                    <tr
                      key={c.id}
                      className="border-t border-white/[0.04] cursor-pointer hover:bg-white/[0.02] transition-colors"
                      onClick={() => setSelected(c.id)}
                    >
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-semibold shrink-0"
                            style={{ backgroundColor: c.avatarColor + '33', color: c.avatarColor }}
                          >
                            {c.avatar}
                          </div>
                          <span className="text-white font-medium">{c.name}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-slate-400">{c.objective}</td>
                      <td className="py-3 pr-4 text-white font-semibold">{c.weight} kg</td>
                      <td className="py-3 pr-4">
                        <span className={c.adherenceNutrition >= 85 ? 'text-emerald-400' : c.adherenceNutrition >= 65 ? 'text-amber-400' : 'text-rose-400'}>
                          {c.adherenceNutrition}%
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={c.adherenceTraining >= 85 ? 'text-emerald-400' : c.adherenceTraining >= 65 ? 'text-amber-400' : 'text-rose-400'}>
                          {c.adherenceTraining}%
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
    </Layout>
  )
}
