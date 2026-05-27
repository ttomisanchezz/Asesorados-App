import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, ClipboardCheck, TrendingUp, Settings } from 'lucide-react'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Inicio' },
  { to: '/clients', icon: Users, label: 'Clientes' },
  { to: '/checkins', icon: ClipboardCheck, label: 'Check-ins' },
  { to: '/progress', icon: TrendingUp, label: 'Progreso' },
  { to: '/settings', icon: Settings, label: 'Ajustes' },
]

export default function BottomNav() {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0d0d14]/95 backdrop-blur-md border-t border-white/[0.08] px-2 pb-safe">
      <div className="flex items-center justify-around py-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all ${
                isActive ? 'text-accent' : 'text-slate-500 hover:text-slate-300'
              }`
            }
          >
            <Icon size={20} />
            <span className="text-[10px] font-medium">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
