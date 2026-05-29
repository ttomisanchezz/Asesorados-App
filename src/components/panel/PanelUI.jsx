import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

/**
 * Componentes locales del panel del asesorado (/mi-panel y subrutas).
 * Pensados para mantener una identidad visual consistente entre todas las
 * pantallas sin tocar los componentes globales de `components/ui`.
 */

// ── Header compartido de subpáginas ──────────────────────────────────────────
// Sticky, compacto, con botón de volver y título. Subtítulo opcional.
export function SubpageHeader({ title, subtitle }) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-surface-900/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3.5">
        <Link
          to="/mi-panel"
          aria-label="Volver a mi panel"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <ArrowLeft size={16} />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold tracking-tight text-white">{title}</h1>
          {subtitle && (
            <p className="truncate text-xs text-slate-500">{subtitle}</p>
          )}
        </div>
      </div>
    </header>
  )
}

// ── Empty state premium del panel ────────────────────────────────────────────
// Centrado, con halo sutil de acento. Variante de tono según `tone`.
export function PanelEmpty({ icon: Icon, title, description, tone = 'neutral', action }) {
  const tones = {
    neutral: { ring: 'ring-white/[0.06]', glow: 'bg-white/[0.04]', icon: 'text-slate-400' },
    accent: { ring: 'ring-accent/20', glow: 'bg-accent/10', icon: 'text-accent' },
    danger: { ring: 'ring-rose-500/20', glow: 'bg-rose-500/10', icon: 'text-rose-400' },
  }
  const t = tones[tone] || tones.neutral

  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className={`relative mb-5 flex h-16 w-16 items-center justify-center rounded-2xl ${t.glow} ring-1 ${t.ring}`}>
        {Icon && <Icon size={26} className={t.icon} strokeWidth={1.75} />}
      </div>
      <h2 className="text-base font-semibold text-white">{title}</h2>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-slate-500">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

// ── Botón "Volver a mi panel" textual, para el pie de las subpáginas ─────────
export function BackToPanel() {
  return (
    <Link
      to="/mi-panel"
      className="mt-2 inline-flex items-center gap-2 self-start rounded-lg text-sm text-slate-500 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
    >
      <ArrowLeft size={14} />
      Volver a mi panel
    </Link>
  )
}
