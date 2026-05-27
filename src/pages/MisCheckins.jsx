import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Zap, ClipboardCheck, Clock } from 'lucide-react'

function SubHeader({ title }) {
  const navigate = useNavigate()
  return (
    <header className="sticky top-0 z-40 flex items-center gap-3 px-4 py-4 bg-[#0a0a0f]/95 backdrop-blur-md border-b border-white/[0.06]">
      <button
        onClick={() => navigate('/mi-panel')}
        aria-label="Volver al panel"
        className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/[0.05] hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft size={15} />
      </button>
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg bg-accent flex items-center justify-center">
          <Zap size={11} className="text-white" />
        </div>
        <span className="text-white font-semibold text-sm tracking-tight">{title}</span>
      </div>
    </header>
  )
}

export default function MisCheckins() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#0a0a0f] pb-10">
      <SubHeader title="Mis check-ins" />

      <div className="max-w-2xl mx-auto px-4 pt-6 flex flex-col gap-5">

        {/* Intro */}
        <div>
          <h1 className="text-xl font-bold text-white">Mis check-ins</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Registro semanal de tu progreso
          </p>
        </div>

        {/* Info card */}
        <div className="bg-[#111118] border border-white/[0.06] rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
              <ClipboardCheck size={18} className="text-amber-400" />
            </div>
            <div>
              <div className="text-white font-semibold text-sm">Próximamente</div>
              <div className="text-slate-500 text-xs mt-0.5">
                Esta función está en desarrollo
              </div>
            </div>
          </div>
          <p className="text-slate-400 text-sm leading-relaxed">
            Próximamente vas a poder cargar tu peso, medidas, sensaciones y adherencia semanal desde acá.
          </p>
        </div>

        {/* Check-in pendiente */}
        <div className="bg-[#111118] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-white font-semibold text-sm">Check-in semanal</div>
            <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 text-[10px] font-bold uppercase tracking-wide">
              Pendiente
            </span>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 text-sm">
              <Clock size={14} className="text-slate-500 shrink-0" />
              <span className="text-slate-400">Día sugerido: <strong className="text-slate-300">viernes</strong></span>
            </div>

            <div className="flex flex-col gap-2 mt-1">
              {['Peso corporal', 'Fotos de progreso', 'Sensaciones de la semana', 'Adherencia nutricional', 'Adherencia al entrenamiento'].map((item) => (
                <div key={item} className="flex items-center gap-2.5 text-slate-500 text-xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/10 shrink-0" />
                  {item}
                </div>
              ))}
            </div>

            <button
              disabled
              className="mt-2 w-full py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-slate-600 text-sm font-medium cursor-not-allowed"
            >
              Cargar check-in — próximamente
            </button>
          </div>
        </div>

        {/* Volver */}
        <button
          onClick={() => navigate('/mi-panel')}
          className="flex items-center gap-2 text-slate-500 hover:text-white text-sm transition-colors self-start mt-2"
        >
          <ArrowLeft size={14} />
          Volver a mi panel
        </button>

      </div>
    </div>
  )
}
