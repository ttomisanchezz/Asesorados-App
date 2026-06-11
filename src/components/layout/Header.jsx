import { useLocation } from 'react-router-dom'
import { Zap } from 'lucide-react'

const titles = {
  '/dashboard': 'Dashboard',
  '/clients': 'Asesorados',
  '/nutrition': 'Nutrición',
  '/training': 'Entrenamiento',
  '/checkins': 'Check-ins',
  '/progress': 'Progreso',
  '/settings': 'Ajustes',
}

export default function Header() {
  const location = useLocation()
  const base = '/' + location.pathname.split('/')[1]
  const title = titles[base] || 'Asesorados'

  return (
    <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3.5 bg-[#0a0a0f]/90 backdrop-blur-md border-b border-white/[0.06]">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
          <Zap size={14} className="text-white" />
        </div>
        <span className="text-white font-semibold text-sm">{title}</span>
      </div>
    </header>
  )
}
