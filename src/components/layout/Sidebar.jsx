import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Utensils,
  Dumbbell,
  ClipboardCheck,
  TrendingUp,
  Settings,
  Zap,
} from 'lucide-react'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/clients', icon: Users, label: 'Asesorados' },
  { to: '/nutrition', icon: Utensils, label: 'Nutrición' },
  { to: '/training', icon: Dumbbell, label: 'Entrenamiento' },
  { to: '/checkins', icon: ClipboardCheck, label: 'Check-ins' },
  { to: '/progress', icon: TrendingUp, label: 'Progreso' },
]

export default function Sidebar() {
  const location = useLocation()

  return (
    <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-[#0d0d14] border-r border-white/[0.06] min-h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/[0.06]">
        <div className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center">
          <Zap size={16} className="text-white" />
        </div>
        <div>
          <span className="text-white font-bold text-sm tracking-tight">Asesorados</span>
          <div className="text-slate-500 text-xs">Coach Pro</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-accent/15 text-accent border border-accent/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-4 border-t border-white/[0.06] pt-4">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              isActive
                ? 'bg-accent/15 text-accent border border-accent/20'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
            }`
          }
        >
          <Settings size={18} />
          Ajustes
        </NavLink>

        {/* Coach card */}
        <div className="mt-3 flex items-center gap-3 px-3 py-3 rounded-xl bg-white/[0.03]">
          <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-xs">
            TC
          </div>
          <div className="min-w-0">
            <div className="text-white text-xs font-semibold truncate">Tu Coach</div>
            <div className="text-slate-500 text-xs truncate">Pro Plan</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
