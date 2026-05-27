export default function StatCard({ label, value, sub, icon: Icon, iconColor = 'text-accent', trend, className = '' }) {
  return (
    <div className={`bg-[#111118] border border-white/[0.06] rounded-2xl p-5 flex flex-col gap-3 hover:border-white/10 transition-colors ${className}`}>
      <div className="flex items-start justify-between">
        <span className="text-slate-400 text-sm font-medium">{label}</span>
        {Icon && (
          <div className={`p-2 rounded-xl bg-white/5 ${iconColor}`}>
            <Icon size={18} />
          </div>
        )}
      </div>
      <div>
        <div className="text-3xl font-bold text-white tracking-tight">{value}</div>
        {sub && <div className="text-slate-500 text-xs mt-1">{sub}</div>}
      </div>
      {trend !== undefined && (
        <div className={`text-xs font-medium ${trend >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% vs semana anterior
        </div>
      )}
    </div>
  )
}
