const variants = {
  active: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
  paused: 'bg-amber-500/15 text-amber-400 border border-amber-500/25',
  finished: 'bg-slate-500/15 text-slate-400 border border-slate-500/25',
  high: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
  medium: 'bg-amber-500/15 text-amber-400 border border-amber-500/25',
  low: 'bg-rose-500/15 text-rose-400 border border-rose-500/25',
  maintain: 'bg-sky-500/15 text-sky-400 border border-sky-500/25',
  adjust: 'bg-violet-500/15 text-violet-400 border border-violet-500/25',
  review: 'bg-amber-500/15 text-amber-400 border border-amber-500/25',
  default: 'bg-slate-700/50 text-slate-300 border border-slate-600/30',
}

const labels = {
  active: 'Activo',
  paused: 'Pausado',
  finished: 'Finalizado',
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
  maintain: 'Mantener',
  adjust: 'Ajustar',
  review: 'Revisar',
}

export default function Badge({ variant = 'default', children, className = '' }) {
  const cls = variants[variant] || variants.default
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls} ${className}`}>
      {children || labels[variant] || variant}
    </span>
  )
}
