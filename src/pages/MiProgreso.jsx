import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Zap, TrendingUp, AlertCircle } from 'lucide-react'
import { getMyClientProfile } from '../services/clientService'
import { PageLoader } from '../components/ui/LoadingSpinner'

function SubHeader({ title }) {
  const navigate = useNavigate()
  return (
    <header className="sticky top-0 z-40 flex items-center gap-3 px-4 py-4 bg-[#0a0a0f]/95 backdrop-blur-md border-b border-white/[0.06]">
      <button
        onClick={() => navigate('/mi-panel')}
        aria-label="Volver al panel"
        className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/[0.05] hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft size={15} />
      </button>
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg bg-accent flex items-center justify-center">
          <Zap size={11} className="text-white" />
        </div>
        <span className="text-white font-semibold text-sm tracking-tight">{title}</span>
      </div>
    </header>
  )
}

function StatRow({ label, value, sub, color = 'text-white' }) {
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-white/[0.04] last:border-0">
      <div>
        <div className="text-slate-400 text-sm">{label}</div>
        {sub && <div className="text-slate-600 text-xs mt-0.5">{sub}</div>}
      </div>
      <div className={`font-bold text-lg ${color}`}>{value}</div>
    </div>
  )
}

function AdherenceBar({ label, value }) {
  const color = value >= 85 ? 'bg-emerald-500' : value >= 65 ? 'bg-amber-500' : 'bg-rose-500'
  const textColor = value >= 85 ? 'text-emerald-400' : value >= 65 ? 'text-amber-400' : 'text-rose-400'

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-slate-400 text-sm">{label}</span>
        <span className={`font-bold text-sm ${textColor}`}>{value}%</span>
      </div>
      <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-700`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  )
}

export default function MiProgreso() {
  const navigate  = useNavigate()
  const [client, setClient]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    getMyClientProfile()
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        setClient(data ?? null)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-[#0a0a0f] pb-10">
      <SubHeader title="Mi progreso" />

      {loading && <PageLoader label="Cargando tu progreso..." />}

      {!loading && (
        <div className="max-w-2xl mx-auto px-4 pt-6 flex flex-col gap-6">

          {/* Intro */}
          <div>
            <h1 className="text-xl font-bold text-white">Mi progreso</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Acá vas a ver tu evolución de peso, medidas, fotos y adherencia
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-3 p-4 bg-rose-500/8 border border-rose-500/20 rounded-xl">
              <AlertCircle size={16} className="text-rose-400 shrink-0" />
              <p className="text-rose-300 text-sm">{error}</p>
            </div>
          )}

          {/* Datos actuales del perfil */}
          {client && (
            <>
              <div className="bg-[#111118] border border-white/[0.06] rounded-2xl overflow-hidden">
                <div className="px-5 pt-5 pb-3 border-b border-white/[0.04]">
                  <div className="text-white font-semibold text-sm">Métricas actuales</div>
                </div>
                <div className="px-5 py-2">
                  {client.weight && (
                    <StatRow
                      label="Peso actual"
                      value={`${client.weight} kg`}
                      color="text-white"
                    />
                  )}
                  {client.targetWeight && (
                    <StatRow
                      label="Peso objetivo"
                      value={`${client.targetWeight} kg`}
                      color="text-accent"
                    />
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
                    <StatRow
                      label="Altura"
                      value={`${client.height} cm`}
                      color="text-slate-300"
                    />
                  )}
                </div>
              </div>

              {/* Adherencia */}
              {(client.adherenceNutrition > 0 || client.adherenceTraining > 0) && (
                <div className="bg-[#111118] border border-white/[0.06] rounded-2xl p-5 flex flex-col gap-4">
                  <div className="text-white font-semibold text-sm">Adherencia semanal</div>
                  <AdherenceBar label="Nutrición" value={client.adherenceNutrition} />
                  <AdherenceBar label="Entrenamiento" value={client.adherenceTraining} />
                </div>
              )}
            </>
          )}

          {/* Próximamente */}
          <div className="bg-[#111118] border border-white/[0.06] rounded-2xl p-5 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                <TrendingUp size={16} className="text-blue-400" />
              </div>
              <div>
                <div className="text-white font-semibold text-sm">Gráficos de evolución</div>
                <div className="text-slate-500 text-xs mt-0.5">Próximamente</div>
              </div>
            </div>
            <p className="text-slate-500 text-sm leading-relaxed">
              Historial de peso, fotos de progreso y evolución de adherencia semana a semana estarán disponibles próximamente.
            </p>
          </div>

          {/* Volver */}
          <button
            onClick={() => navigate('/mi-panel')}
            className="flex items-center gap-2 text-slate-500 hover:text-white text-sm transition-colors self-start mt-2"
          >
            <ArrowLeft size={14} />
            Volver a mi panel
          </button>

        </div>
      )}
    </div>
  )
}
