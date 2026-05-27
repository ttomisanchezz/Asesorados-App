import { Bell, Shield, User, Palette, Database, ChevronRight, Zap } from 'lucide-react'
import Layout from '../components/layout/Layout'
import PageHeader from '../components/ui/PageHeader'
import SectionCard from '../components/ui/SectionCard'
import Button from '../components/ui/Button'

const settingSections = [
  {
    icon: User,
    title: 'Perfil del coach',
    items: [
      { label: 'Nombre', value: 'Tu Coach' },
      { label: 'Email', value: 'coach@asesorados.app' },
      { label: 'Especialidad', value: 'Fitness & Nutrición' },
      { label: 'Plan', value: 'Pro (Beta)' },
    ],
  },
  {
    icon: Bell,
    title: 'Notificaciones',
    items: [
      { label: 'Check-ins pendientes', value: 'Activado', toggle: true },
      { label: 'Recordatorios de revisión', value: 'Activado', toggle: true },
      { label: 'Alertas de baja adherencia', value: 'Activado', toggle: true },
    ],
  },
  {
    icon: Database,
    title: 'Datos y privacidad',
    items: [
      { label: 'Exportar datos', value: 'CSV / JSON' },
      { label: 'Backup automático', value: 'Activado' },
    ],
  },
]

export default function Settings() {
  return (
    <Layout>
      <PageHeader title="Ajustes" subtitle="Configuración de tu cuenta y preferencias" />

      <div className="max-w-2xl flex flex-col gap-4">
        {/* Profile card */}
        <div className="bg-[#111118] border border-white/[0.06] rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-accent/20 flex items-center justify-center text-accent font-bold text-xl">
              TC
            </div>
            <div>
              <h2 className="text-white font-semibold text-lg">Tu Coach</h2>
              <p className="text-slate-400 text-sm">coach@asesorados.app</p>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-accent/10 border border-accent/20 rounded-full">
                  <Zap size={12} className="text-accent" />
                  <span className="text-accent text-xs font-medium">Pro Beta</span>
                </div>
              </div>
            </div>
            <Button variant="secondary" size="sm" className="ml-auto">
              Editar perfil
            </Button>
          </div>
        </div>

        {settingSections.map(({ icon: Icon, title, items }) => (
          <SectionCard key={title} title={title}>
            <div className="flex flex-col gap-1">
              {items.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between py-3 border-b border-white/[0.04] last:border-0"
                >
                  <span className="text-slate-300 text-sm">{item.label}</span>
                  <div className="flex items-center gap-2">
                    {item.toggle ? (
                      <div className="w-10 h-5 bg-accent rounded-full relative cursor-pointer">
                        <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full" />
                      </div>
                    ) : (
                      <span className="text-slate-500 text-sm">{item.value}</span>
                    )}
                    {!item.toggle && <ChevronRight size={14} className="text-slate-600" />}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        ))}

        <SectionCard title="Acerca de Asesorados App">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Versión</span>
              <span className="text-white">0.1.0-beta</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Stack</span>
              <span className="text-slate-400">React + Vite + Tailwind</span>
            </div>
            <div className="mt-2 p-3 bg-accent/5 border border-accent/15 rounded-xl">
              <p className="text-slate-400 text-xs leading-relaxed">
                <span className="text-accent font-medium">Asesorados App</span> es una plataforma de gestión para coaches de fitness y nutrición.
                Esta es una versión beta en desarrollo activo.
              </p>
            </div>
          </div>
        </SectionCard>
      </div>
    </Layout>
  )
}
