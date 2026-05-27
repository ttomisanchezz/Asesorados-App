import { useNavigate } from 'react-router-dom'
import {
  Zap, Users, Utensils, Dumbbell, ClipboardCheck, TrendingUp,
  CheckCircle, ArrowRight, MessageSquare, FileSpreadsheet, FolderOpen,
  Shield, BarChart2, Calendar
} from 'lucide-react'
import Button from '../components/ui/Button'

const PROBLEMS = [
  { icon: MessageSquare, text: 'Planes enviados por WhatsApp que se pierden entre mensajes' },
  { icon: FileSpreadsheet, text: 'Hojas de Excel imposibles de mantener actualizadas' },
  { icon: FolderOpen, text: 'PDFs, notas, fotos y datos dispersos sin conexión entre sí' },
  { icon: Calendar, text: 'Revisiones manuales que consumen tiempo que no tenés' },
]

const FEATURES = [
  { icon: Users, title: 'Gestión de asesorados', desc: 'Todos tus asesorados en un solo lugar. Estado, adherencia, progreso y notas internas.' },
  { icon: Utensils, title: 'Planes nutricionales', desc: 'Calorías, macros y comidas del día. Historial de actualizaciones y adherencia real.' },
  { icon: Dumbbell, title: 'Rutinas de entrenamiento', desc: 'Ejercicios, series, cargas y progresión. Vinculados directamente a cada asesorado.' },
  { icon: ClipboardCheck, title: 'Check-ins semanales', desc: 'Seguimiento estructurado de peso, energía, sueño, estrés y adherencia al plan.' },
  { icon: TrendingUp, title: 'Progreso visual', desc: 'Evolución de peso, medidas y adherencia en el tiempo. Sin hojas de cálculo.' },
  { icon: Shield, title: 'Información centralizada', desc: 'Todo lo que sabés de cada asesorado en un mismo lugar. Seguro y organizado.' },
]

const BENEFITS = [
  'Ahorrás tiempo en tareas administrativas',
  'Tomás mejores decisiones con datos reales',
  'Tus asesorados perciben más profesionalismo',
  'Seguimiento consistente sin depender de tu memoria',
  'Preparado para escalar tu práctica',
]

const MOCK_STATS = [
  { value: '5', label: 'Asesorados activos' },
  { value: '92%', label: 'Adherencia promedio' },
  { value: '4', label: 'Check-ins esta semana' },
]

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/[0.05] max-w-6xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center">
            <Zap size={16} className="text-white" />
          </div>
          <span className="text-white font-bold tracking-tight">Asesorados</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
            Acceder
          </Button>
          <Button size="sm" onClick={() => navigate('/dashboard')}>
            Probar ahora
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-sm font-medium mb-8">
          <Zap size={14} /> Beta disponible para coaches
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight tracking-tight mb-6">
          Gestioná tus asesorados
          <br />
          <span className="text-gradient">sin el caos</span>
        </h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
          La plataforma de un coach fitness/nutrición profesional. Centraliza asesorados, planes, rutinas, check-ins y progreso en un solo lugar.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-16">
          <Button size="lg" iconRight={ArrowRight} onClick={() => navigate('/dashboard')}>
            Ver el dashboard
          </Button>
          <Button variant="secondary" size="lg" onClick={() => navigate('/clients')}>
            Ver asesorados
          </Button>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
          {MOCK_STATS.map((s) => (
            <div key={s.label} className="bg-[#111118] border border-white/[0.06] rounded-xl py-4 px-3">
              <div className="text-2xl font-bold text-accent mb-0.5">{s.value}</div>
              <div className="text-slate-500 text-xs">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Problem */}
      <section className="max-w-6xl mx-auto px-6 py-16 border-t border-white/[0.05]">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            ¿Cómo gestionás tus asesorados hoy?
          </h2>
          <p className="text-slate-400">
            La mayoría de los coaches manejan su práctica con herramientas que no fueron diseñadas para esto.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PROBLEMS.map(({ icon: Icon, text }) => (
            <div key={text} className="bg-[#111118] border border-rose-500/10 rounded-2xl p-5 flex flex-col gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
                <Icon size={20} className="text-rose-400" />
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-16 border-t border-white/[0.05]">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Todo lo que necesitás, en un solo lugar
          </h2>
          <p className="text-slate-400">
            Construido específicamente para coaches de fitness y nutrición que quieren trabajar de forma profesional.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-[#111118] border border-white/[0.06] rounded-2xl p-5 hover:border-accent/25 transition-colors group">
              <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                <Icon size={22} className="text-accent" />
              </div>
              <h3 className="text-white font-semibold mb-2">{title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="max-w-6xl mx-auto px-6 py-16 border-t border-white/[0.05]">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6">
              Trabajá como el coach que querés ser
            </h2>
            <div className="flex flex-col gap-3">
              {BENEFITS.map((b) => (
                <div key={b} className="flex items-start gap-3">
                  <CheckCircle size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                  <span className="text-slate-300 text-sm">{b}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-[#111118] border border-white/[0.06] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                <BarChart2 size={20} className="text-accent" />
              </div>
              <div>
                <div className="text-white font-semibold text-sm">Dashboard del coach</div>
                <div className="text-slate-500 text-xs">Vista semanal</div>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {[
                { label: 'Adherencia nutricional prom.', value: 82, color: 'accent' },
                { label: 'Adherencia entrenamiento prom.', value: 90, color: 'emerald' },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1.5 text-xs">
                    <span className="text-slate-400">{item.label}</span>
                    <span className={item.color === 'emerald' ? 'text-emerald-400 font-semibold' : 'text-accent font-semibold'}>{item.value}%</span>
                  </div>
                  <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.color === 'emerald' ? 'bg-emerald-500' : 'bg-accent'}`}
                      style={{ width: `${item.value}%` }}
                    />
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-3 gap-2 mt-2">
                {[
                  { v: '4', l: 'Check-ins' },
                  { v: '2', l: 'Ajustes' },
                  { v: '1', l: 'Pausados' },
                ].map((s) => (
                  <div key={s.l} className="bg-white/[0.03] rounded-xl p-2.5 text-center">
                    <div className="text-white font-bold text-lg">{s.v}</div>
                    <div className="text-slate-600 text-xs">{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 py-16 border-t border-white/[0.05]">
        <div className="bg-gradient-to-br from-accent/15 via-accent/8 to-transparent border border-accent/20 rounded-3xl p-10 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Listo para empezar
          </h2>
          <p className="text-slate-400 mb-8 max-w-md mx-auto">
            Explorá el dashboard y todas las secciones. Actualmente en beta con datos de muestra.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" iconRight={ArrowRight} onClick={() => navigate('/dashboard')}>
              Abrir el dashboard
            </Button>
            <Button variant="secondary" size="lg" onClick={() => navigate('/clients')}>
              Ver asesorados
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.05] py-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-lg bg-accent flex items-center justify-center">
            <Zap size={12} className="text-white" />
          </div>
          <span className="text-white font-semibold text-sm">Asesorados App</span>
        </div>
        <p className="text-slate-600 text-xs">Beta v0.1.0 · Construido para coaches que buscan crecer</p>
      </footer>
    </div>
  )
}
