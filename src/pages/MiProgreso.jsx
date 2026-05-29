import { useState, useEffect } from 'react'
import { TrendingUp, AlertCircle } from 'lucide-react'
import { getMyClientProfile } from '../services/clientService'
import { getMyProgress } from '../services/progressService'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { SubpageHeader, PanelEmpty, BackToPanel } from '../components/panel/PanelUI'

function StatRow({ label, value, sub, color = 'text-white' }) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.04] py-3.5 last:border-0">
      <div>
        <div className="text-sm text-slate-400">{label}</div>
        {sub && <div className="mt-0.5 text-xs text-slate-600">{sub}</div>}
      </div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
    </div>
  )
}

function AdherenceBar({ label, value }) {
  const color = value >= 85 ? 'bg-emerald-500' : value >= 65 ? 'bg-amber-500' : 'bg-rose-500'
  const textColor = value >= 85 ? 'text-emerald-400' : value >= 65 ? 'text-amber-400' : 'text-rose-400'

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">{label}</span>
        <span className={`text-sm font-bold ${textColor}`}>{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  )
}

export default function MiProgreso() {
  const [client, setClient] = useState(null)
  const [progress, setProgress] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Perfil (métricas actuales) + historial de progress_metrics, en paralelo.
    Promise.allSettled([getMyClientProfile(), getMyProgress()])
      .then(([profile, prog]) => {
        if (profile.status === 'fulfilled') {
          if (profile.value?.error) setError(profile.value.error.message)
          setClient(profile.value?.data ?? null)
        } else {
          setError('No se pudo cargar tu perfil')
        }
        setProgress(prog.status === 'fulfilled' ? (prog.value?.data ?? null) : null)
      })
      .finally(() => setLoading(false))
  }, [])

  const hasHistory = progress?.weightHistory?.length > 0
  const hasAdherence = client && (client.adherenceNutrition > 0 || client.adherenceTraining > 0)
  const hasMetrics =
    (client && (client.weight || client.targetWeight || client.height || hasAdherence)) || hasHistory

  return (
    <div className="min-h-[100dvh] bg-surface-900 pb-12">
      <SubpageHeader title="Mi progreso" subtitle="Peso, medidas y evolución" />

      {loading && <PageLoader label="Cargando tu progreso..." />}

      {!loading && error && (
        <PanelEmpty
          icon={AlertCircle}
          tone="danger"
          title="No se pudo cargar tu progreso"
          description={error}
        />
      )}

      {!loading && !error && !hasMetrics && (
        <PanelEmpty
          icon={TrendingUp}
          title="Todavía no hay métricas suficientes para mostrar tu progreso"
          description="Cuando tu coach cargue tu peso, medidas o adherencia, vas a ver tu evolución acá."
        />
      )}

      {!loading && !error && hasMetrics && (
        <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 pt-6">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Mi progreso</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Tu evolución de peso, medidas y adherencia
            </p>
          </div>

          {/* Métricas actuales */}
          <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-surface-800">
            <div className="border-b border-white/[0.04] px-5 pb-3 pt-5">
              <div className="text-sm font-semibold text-white">Métricas actuales</div>
            </div>
            <div className="px-5 py-2">
              {client.weight && (
                <StatRow label="Peso actual" value={`${client.weight} kg`} color="text-white" />
              )}
              {client.targetWeight && (
                <StatRow label="Peso objetivo" value={`${client.targetWeight} kg`} color="text-accent" />
              )}
              {client.weight && client.targetWeight && (
                <StatRow
                  label="Diferencia"
                  value={`${Math.abs(client.targetWeight - client.weight).toFixed(1)} kg`}
                  sub={client.targetWeight < client.weight ? 'por bajar' : 'por subir'}
                  color="text-slate-300"
                />
              )}
              {client.height && (
                <StatRow label="Altura" value={`${client.height} cm`} color="text-slate-300" />
              )}
            </div>
          </div>

          {/* Evolución de peso (historial real de progress_metrics) */}
          {hasHistory && (
            <div className="rounded-2xl border border-white/[0.06] bg-surface-800 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm font-semibold text-white">Evolución de peso</div>
                <div className="text-xs text-slate-500">{progress.weightHistory.length} registros</div>
              </div>
              <div className="flex h-32 items-end gap-1">
                {progress.weightHistory.map((w, i) => {
                  const max = Math.max(...progress.weightHistory)
                  const min = Math.min(...progress.weightHistory) - 0.5
                  const range = max - min || 1
                  const heightPct = ((w - min) / range) * 70 + 25
                  const isLast = i === progress.weightHistory.length - 1
                  return (
                    <div key={i} className="flex flex-1 flex-col items-center gap-1">
                      {isLast && <span className="text-[9px] font-bold text-emerald-400">{w}</span>}
                      <div
                        className={`w-full rounded-t-md transition-all ${isLast ? 'bg-accent' : 'bg-accent/30'}`}
                        style={{ height: `${heightPct}%` }}
                        title={`${w} kg · ${progress.dates[i]}`}
                      />
                      {(i === 0 || isLast) && (
                        <span className="text-[8px] leading-tight text-slate-600">{progress.dates[i]}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Medidas corporales (si el último registro las tiene) */}
          {progress?.measurements &&
            Object.values(progress.measurements).some((v) => v != null) && (
              <div className="rounded-2xl border border-white/[0.06] bg-surface-800 p-5">
                <div className="mb-4 text-sm font-semibold text-white">Últimas medidas</div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Cintura', value: progress.measurements.waist },
                    { label: 'Pecho', value: progress.measurements.chest },
                    { label: 'Cadera', value: progress.measurements.hip },
                    { label: 'Brazo', value: progress.measurements.arm },
                    { label: 'Pierna', value: progress.measurements.leg },
                  ]
                    .filter((m) => m.value != null)
                    .map((m) => (
                      <div key={m.label} className="rounded-xl bg-white/[0.02] p-3 text-center">
                        <div className="mb-0.5 text-xs text-slate-500">{m.label}</div>
                        <div className="font-bold text-white">{m.value} cm</div>
                      </div>
                    ))}
                </div>
              </div>
            )}

          {/* Adherencia */}
          {hasAdherence && (
            <div className="flex flex-col gap-4 rounded-2xl border border-white/[0.06] bg-surface-800 p-5">
              <div className="text-sm font-semibold text-white">Adherencia semanal</div>
              <AdherenceBar label="Nutrición" value={client.adherenceNutrition} />
              <AdherenceBar label="Entrenamiento" value={client.adherenceTraining} />
            </div>
          )}

          {/* Próximamente */}
          <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.015] p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.04]">
                <TrendingUp size={16} className="text-slate-400" strokeWidth={1.75} />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">Gráficos de evolución</div>
                <div className="mt-0.5 text-xs text-slate-500">Disponibles próximamente</div>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-slate-500">
              El historial de peso, las fotos de progreso y la evolución semana a semana van a
              aparecer acá a medida que cargues tus check-ins.
            </p>
          </div>

          <BackToPanel />
        </div>
      )}
    </div>
  )
}
