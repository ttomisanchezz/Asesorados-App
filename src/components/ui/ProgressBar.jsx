export default function ProgressBar({ value, max = 100, color = 'accent', label, showValue = true }) {
  // value null/undefined o max 0 → barra en 0, nunca NaN en el width.
  const safeValue = Number(value) || 0
  const safeMax = Number(max) || 100
  const pct = Math.max(0, Math.min(100, Math.round((safeValue / safeMax) * 100)))

  const colors = {
    accent: 'bg-accent',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    sky: 'bg-sky-500',
  }

  const textColors = {
    accent: 'text-accent',
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    rose: 'text-rose-400',
    sky: 'text-sky-400',
  }

  const barColor = colors[color] || colors.accent
  const valColor = textColors[color] || textColors.accent

  return (
    <div className="w-full">
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && <span className="text-slate-400 text-xs">{label}</span>}
          {showValue && <span className={`text-xs font-semibold ${valColor}`}>{pct}%</span>}
        </div>
      )}
      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
