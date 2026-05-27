import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Utensils, Zap, AlertCircle } from 'lucide-react'
import { getMyNutritionPlan } from '../services/nutritionService'
import { PageLoader } from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'

// ── Header compartido de sub-páginas del alumno ──────────────────────────────
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

// ── Tile de macro (calorías, proteínas, etc.) ────────────────────────────────
function MacroTile({ label, value, unit, color }) {
  return (
    <div className="bg-[#111118] border border-white/[0.06] rounded-xl p-4 flex flex-col gap-1">
      <span className="text-slate-500 text-xs">{label}</span>
      <span className={`font-bold text-2xl leading-tight ${color}`}>
        {value}
        <span className="text-sm font-normal text-slate-500 ml-0.5">{unit}</span>
      </span>
    </div>
  )
}

// ── Opción de comida: título + kcal + macros + lista de alimentos ────────────
function OptionCard({ option }) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-white text-sm font-semibold leading-snug">{option.title}</span>
        {option.kcal != null && (
          <span className="text-accent text-sm font-bold shrink-0">{option.kcal} kcal</span>
        )}
      </div>

      {option.macros && (
        <div className="flex gap-4 text-xs text-slate-500">
          {option.macros.p != null && (
            <span>P: <strong className="text-slate-300">{option.macros.p}g</strong></span>
          )}
          {option.macros.c != null && (
            <span>C: <strong className="text-slate-300">{option.macros.c}g</strong></span>
          )}
          {option.macros.f != null && (
            <span>G: <strong className="text-slate-300">{option.macros.f}g</strong></span>
          )}
        </div>
      )}

      {option.items?.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {option.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-400 leading-snug">
              <span className="text-accent mt-0.5 shrink-0">·</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Slot de comida (Desayuno, Almuerzo, …) con sus opciones ─────────────────
function MealSlot({ meal }) {
  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-slate-400 text-xs font-semibold uppercase tracking-widest">
        {meal.name}
      </h4>
      {meal.options?.map((opt, i) => (
        <OptionCard key={i} option={opt} />
      ))}
    </div>
  )
}

// ── Esquema de dieta completo (Dieta 1, Dieta 2, …) ─────────────────────────
function SchemeSection({ scheme, index }) {
  return (
    <div className="bg-[#111118] border border-white/[0.06] rounded-2xl overflow-hidden">
      <div className="px-5 pt-5 pb-4 border-b border-white/[0.04]">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="w-5 h-5 rounded-lg bg-accent/15 flex items-center justify-center text-accent text-[10px] font-bold shrink-0">
            {index + 1}
          </span>
          <h3 className="text-white font-semibold text-sm leading-snug">{scheme.scheme}</h3>
        </div>
        {scheme.description && (
          <p className="text-slate-500 text-xs leading-relaxed">{scheme.description}</p>
        )}
      </div>

      <div className="px-5 py-5 flex flex-col gap-6">
        {scheme.meals?.map((meal, i) => (
          <MealSlot key={i} meal={meal} />
        ))}
      </div>
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function MiNutricion() {
  const navigate = useNavigate()
  const [plan, setPlan]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)

  useEffect(() => {
    getMyNutritionPlan()
      .then(({ data, error: err }) => {
        // PGRST116 = no rows — simplemente no hay plan activo, no es un error real
        const noRows = err?.code === 'PGRST116'
        if (err && !noRows) setError(err.message || 'Error al cargar el plan')
        setPlan(data ?? null)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-[#0a0a0f] pb-10">
      <SubHeader title="Mi nutrición" />

      {loading && <PageLoader label="Cargando tu plan..." />}

      {!loading && error && !plan && (
        <EmptyState
          icon={AlertCircle}
          title="No se pudo cargar el plan"
          description={error}
        />
      )}

      {!loading && !error && !plan && (
        <EmptyState
          icon={Utensils}
          title="No hay plan nutricional activo"
          description="Tu coach todavía no cargó tu plan."
        />
      )}

      {!loading && plan && (
        <div className="max-w-2xl mx-auto px-4 pt-6 flex flex-col gap-6">

          {/* Intro */}
          <div>
            <h1 className="text-xl font-bold text-white">Mi nutrición</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Plan actualizado por tu coach
              {plan.lastUpdate && (
                <> · {new Date(plan.lastUpdate).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}</>
              )}
            </p>
          </div>

          {/* Macros resumen */}
          <div className="grid grid-cols-2 gap-3">
            <MacroTile label="Calorías"      value={plan.calories} unit="kcal" color="text-accent" />
            <MacroTile label="Proteínas"     value={plan.protein}  unit="g"    color="text-emerald-400" />
            <MacroTile label="Carbohidratos" value={plan.carbs}    unit="g"    color="text-amber-400" />
            <MacroTile label="Grasas"        value={plan.fat}      unit="g"    color="text-blue-400" />
          </div>

          {/* Nota del coach */}
          {plan.notes && (
            <div className="bg-accent/5 border border-accent/15 rounded-xl p-4 flex items-start gap-3">
              <div className="w-7 h-7 rounded-xl bg-accent/20 flex items-center justify-center shrink-0 mt-0.5">
                <Zap size={12} className="text-accent" />
              </div>
              <div>
                <div className="text-accent text-xs font-semibold mb-1">Nota del coach</div>
                <p className="text-slate-300 text-sm leading-relaxed">{plan.notes}</p>
              </div>
            </div>
          )}

          {/* Esquemas de dieta */}
          {plan.meals?.length > 0 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-white font-semibold text-sm">
                Esquemas de dieta{' '}
                <span className="text-slate-600 font-normal">({plan.meals.length})</span>
              </h2>
              {plan.meals.map((scheme, i) => (
                <SchemeSection key={i} scheme={scheme} index={i} />
              ))}
            </div>
          )}

          {/* Volver */}
          <button
            onClick={() => navigate('/mi-panel')}
            className="flex items-center gap-2 text-slate-500 hover:text-white text-sm transition-colors self-start mt-2"
          >
            <ArrowLeft size={14} />
            Volver a mi panel
          </button>

        </div>
      )}
    </div>
  )
}
