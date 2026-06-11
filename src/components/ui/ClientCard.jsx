import { useNavigate } from 'react-router-dom'
import Badge from './Badge'
import { ArrowRight, Calendar, TrendingUp } from 'lucide-react'

export default function ClientCard({ client }) {
  const navigate = useNavigate()

  const adherenceColor = (val) => {
    if (val >= 85) return 'text-emerald-400'
    if (val >= 65) return 'text-amber-400'
    return 'text-rose-400'
  }

  return (
    <div
      className="bg-[#111118] border border-white/[0.06] rounded-2xl p-5 flex flex-col gap-4 hover:border-accent/30 hover:bg-[#1a1a24] transition-all cursor-pointer group"
      onClick={() => navigate(`/clients/${client.id}`)}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-semibold text-sm shrink-0"
            style={{ backgroundColor: client.avatarColor + '33', color: client.avatarColor }}
          >
            {client.avatar}
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm leading-tight">{client.name}</h3>
            <p className="text-slate-500 text-xs mt-0.5">{client.objective}</p>
          </div>
        </div>
        <Badge variant={client.status} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/[0.03] rounded-xl p-3">
          <div className="text-slate-500 text-xs mb-1">Adherencia nutricional</div>
          <div className={`text-lg font-bold ${adherenceColor(client.adherenceNutrition)}`}>
            {client.adherenceNutrition}%
          </div>
        </div>
        <div className="bg-white/[0.03] rounded-xl p-3">
          <div className="text-slate-500 text-xs mb-1">Adherencia entreno</div>
          <div className={`text-lg font-bold ${adherenceColor(client.adherenceTraining)}`}>
            {client.adherenceTraining}%
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-white/[0.04]">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs">
            <Calendar size={12} />
            <span>
              {client.lastCheckin
                ? `Último check-in: ${new Date(client.lastCheckin).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}`
                : 'Sin check-ins todavía'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500 text-xs">
            <TrendingUp size={12} />
            <span>
              {[client.weight != null ? `${client.weight} kg` : null, client.objective || null]
                .filter(Boolean).join(' · ') || 'Sin datos de peso'}
            </span>
          </div>
        </div>
        <div className="text-accent opacity-0 group-hover:opacity-100 transition-opacity">
          <ArrowRight size={18} />
        </div>
      </div>
    </div>
  )
}
