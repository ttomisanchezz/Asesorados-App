import { useNavigate } from 'react-router-dom'
import {
  Zap, Utensils, Dumbbell, ClipboardCheck, TrendingUp,
  ArrowRight, CheckCircle, Lock, MessageSquare, RefreshCw, Target
} from 'lucide-react'
import Button from '../components/ui/Button'

const PANEL_SECTIONS = [
  {
    icon: Utensils,
    title: 'Tu plan nutricional',
    desc: 'Calorías objetivo, macros y detalle de cada comida del día. Siempre actualizado por tu coach.',
  },
  {
    icon: Dumbbell,
    title: 'Tu rutina de entrenamiento',
    desc: 'Ejercicios, series, cargas y observaciones técnicas. Adaptada a tus días y objetivos.',
  },
  {
    icon: ClipboardCheck,
    title: 'Tus check-ins semanales',
    desc: 'Cargá tu peso, energía, sueño y adherencia. Tu coach lo revisa y te da feedback.',
  },
  {
    icon: TrendingUp,
    title: 'Tu progreso',
    desc: 'Evolución de peso, medidas y adherencia en el tiempo. Sin planillas, sin confusión.',
  },
  {
    icon: MessageSquare,
    title: 'Indicaciones de tu coach',
    desc: 'Correcciones, notas y próximos ajustes. Todo en un solo lugar, siempre disponible.',
  },
  {
    icon: RefreshCw,
    title: 'Ajustes del plan',
    desc: 'Cuando tu coach actualice algo, lo ves de inmediato. Sin perder mensajes en WhatsApp.',
  },
]

const BENEFITS = [
  'Accedés a tu plan en cualquier momento, desde el celular',
  'No tenés que buscar PDFs ni mensajes de WhatsApp',
  'Ves exactamente qué comer y cómo entrenar hoy',
  'Tu coach puede dejarte indicaciones sin llamarte',
  'Todo tu historial de progreso en un solo lugar',
]

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/[0.05] max-w-5xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center">
            <Zap size={16} className="text-white" />
          </div>
          <span className="text-white font-bold tracking-tight">Asesorados</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/mi-panel')}>
            Ingresar
          </Button>
          <Button size="sm" onClick={() => navigate('/mi-panel')}>
            Mi seguimiento
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-sm font-medium mb-8">
          <Lock size={13} /> Panel privado para asesorados
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight tracking-tight mb-6">
          Tu seguimiento,
          <br />
          <span className="text-gradient">claro y ordenado</span>
        </h1>
        <p className="text-slate-400 text-lg max-w-xl mx-auto mb-10 leading-relaxed">
          Accedé a tu plan nutricional, rutina, check-ins, progreso y correcciones desde un solo lugar.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-16">
          <Button size="lg" iconRight={ArrowRight} onClick={() => navigate('/mi-panel')}>
            Ingresar a mi seguimiento
          </Button>
          <Button variant="secondary" size="lg" onClick={() => navigate('/mi-panel')}>
            Ver mi plan
          </Button>
        </div>

        {/* Preview stats */}
        <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
          {[
            { value: 'Plan', label: 'nutricional actualizado' },
            { value: 'Rutina', label: 'personalizada activa' },
            { value: '100%', label: 'privado y seguro' },
          ].map((s) => (
            <div key={s.label} className="bg-[#111118] border border-white/[0.06] rounded-xl py-4 px-3">
              <div className="text-base font-bold text-accent mb-0.5">{s.value}</div>
              <div className="text-slate-500 text-xs leading-snug">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* What you'll find */}
      <section className="max-w-5xl mx-auto px-6 py-16 border-t border-white/[0.05]">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Todo lo que necesitás en un solo lugar
          </h2>
          <p className="text-slate-400 text-base">
            Tu panel personal tiene todo lo que tu coach preparó para vos.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PANEL_SECTIONS.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="bg-[#111118] border border-white/[0.06] rounded-2xl p-5 hover:border-accent/25 transition-colors group"
            >
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
      <section className="max-w-5xl mx-auto px-6 py-16 border-t border-white/[0.05]">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
              Todo tu seguimiento, siempre disponible
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              Ya no tenés que buscar el PDF en el mail, el PDF que mandó tu coach por WhatsApp, o la planilla que no encontrás. Todo está acá.
            </p>
            <div className="flex flex-col gap-3">
              {BENEFITS.map((b) => (
                <div key={b} className="flex items-start gap-3">
                  <CheckCircle size={17} className="text-emerald-400 shrink-0 mt-0.5" />
                  <span className="text-slate-300 text-sm">{b}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Mini preview card */}
          <div className="bg-[#111118] border border-white/[0.06] rounded-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3 pb-4 border-b border-white/[0.05]">
              <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center text-accent font-bold text-sm">
                VM
              </div>
              <div>
                <div className="text-white font-semibold text-sm">Valentina Morales</div>
                <div className="text-slate-500 text-xs">Pérdida de grasa · Semana 15</div>
              </div>
              <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-emerald-400 text-xs font-medium">Activa</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Calorías hoy', value: '1.750 kcal', color: 'text-accent' },
                { label: 'Adherencia nut.', value: '88%', color: 'text-emerald-400' },
                { label: 'Próximo check-in', value: 'Lunes', color: 'text-white' },
                { label: 'Adherencia ent.', value: '92%', color: 'text-emerald-400' },
              ].map((s) => (
                <div key={s.label} className="bg-white/[0.03] rounded-xl p-3">
                  <div className="text-slate-500 text-xs mb-0.5">{s.label}</div>
                  <div className={`font-bold text-sm ${s.color}`}>{s.value}</div>
                </div>
              ))}
            </div>
            <div className="p-3 bg-accent/5 border border-accent/15 rounded-xl">
              <div className="text-accent text-xs font-semibold mb-0.5">Nota de tu coach</div>
              <p className="text-slate-300 text-xs leading-relaxed">
                "Excelente semana. La adherencia sigue alta. Bajamos 50 kcal la próxima semana."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-6 py-16 border-t border-white/[0.05]">
        <div className="bg-gradient-to-br from-accent/15 via-accent/8 to-transparent border border-accent/20 rounded-3xl p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-accent/20 flex items-center justify-center mx-auto mb-5">
            <Target size={26} className="text-accent" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            Tu evolución, organizada
          </h2>
          <p className="text-slate-400 mb-8 max-w-md mx-auto text-sm leading-relaxed">
            Ingresá a tu panel y revisá todo lo que tu coach preparó para esta semana.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" iconRight={ArrowRight} onClick={() => navigate('/mi-panel')}>
              Ingresar a mi seguimiento
            </Button>
            <Button variant="secondary" size="lg" onClick={() => navigate('/dashboard')}>
              Vista del coach
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
        <p className="text-slate-600 text-xs">Tu panel privado de seguimiento fitness y nutrición</p>
      </footer>
    </div>
  )
}
