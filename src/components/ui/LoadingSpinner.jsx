import { Zap } from 'lucide-react'

export function PageLoader({ label = 'Cargando...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-10 h-10 rounded-2xl bg-accent/20 flex items-center justify-center animate-pulse">
        <Zap size={18} className="text-accent" />
      </div>
      <p className="text-slate-500 text-sm">{label}</p>
    </div>
  )
}

export function InlineSpinner({ size = 16 }) {
  return (
    <div
      className="border-2 border-white/20 border-t-accent rounded-full animate-spin shrink-0"
      style={{ width: size, height: size }}
    />
  )
}
