import { useState, useEffect } from 'react'
import { Utensils, Zap, AlertCircle, ChevronDown } from 'lucide-react'
import { getMyNutritionPlan } from '../services/nutritionService'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { SubpageHeader, PanelEmpty, BackToPanel } from '../components/panel/PanelUI'

const NOTES_PREVIEW_LIMIT = 140

// ── Tile de macro (calorías, proteínas, etc.) ────────────────────────────────
function MacroTile({ label, value, unit, color }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-white/[0.06] bg-surface-800 p-4">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-2xl font-bold leading-tight ${color}`}>
        {value}
        <span className="ml-0.5 text-sm font-normal text-slate-500">{unit}</span>
      </span>
    </div>
  )
}

// ── Nota del coach compacta con acordeón ────────────────────────────────────
function CoachNote({ notes }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = notes.length > NOTES_PREVIEW_LIMIT
  const preview = isLong ? notes.slice(0, NOTES_PREVIEW_LIMIT).trimEnd() + '…' : notes

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-surface-800">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.04]">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent/15">
          <Zap size={12} className="text-accent" />
        </span>
        <span className="text-xs font-semibold text-accent tracking-wide">Nota del coach</span>
      </div>

      {/* Texto */}
      <div className="px-4 pt-3 pb-4">
        <p className="text-sm leading-relaxed text-slate-300">
          {expanded || !isLong ? notes : preview}
        </p>

        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="mt-2.5 flex items-center gap-1 text-xs font-medium text-accent/80 hover:text-accent transition-colors"
          >
            {expanded ? 'Ver menos' : 'Ver nota completa'}
            <ChevronDown
              size={13}
              className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Opción de comida: título + kcal + macros + lista de alimentos ────────────
function OptionCard({ option }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold leading-snug text-white">{option.title}</span>
        {option.kcal != null && (
          <span className="shrink-0 text-sm font-bold text-accent">{option.kcal} kcal</span>
        )}
      </div>

      {option.macros && (
        <div className="flex gap-4 text-xs text-slate-500">
          {option.macros.p != null && <span>P: <strong className="text-slate-300">{option.macros.p}g</strong></span>}
          {option.macros.c != null && <span>C: <strong className="text-slate-300">{option.macros.c}g</strong></span>}
          {option.macros.f != null && <span>G: <strong className="text-slate-300">{option.macros.f}g</strong></span>}
        </div>
      )}

      {option.items?.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {option.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm leading-snug text-slate-400">
              <span className="mt-0.5 shrink-0 text-accent">·</span>
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
      <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-400">{meal.name}</h4>
      {meal.options?.map((opt, i) => <OptionCard key={i} option={opt} />)}
    </div>
  )
}

// ── Esquema de dieta como acordeón ──────────────────────────────────────────
function SchemeSection({ scheme, index, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-surface-800">
      {/* Header — tap target mínimo 44px */}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-start gap-3 px-5 py-4 text-left min-h-[56px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      >
        {/* Chip de número */}
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-[10px] font-bold text-accent">
          {index + 1}
        </span>

        {/* Títulos */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-snug text-white">{scheme.scheme}</p>
          {scheme.description && (
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500 line-clamp-2">
              {scheme.description}
            </p>
          )}
        </div>

        {/* Chevron */}
        <ChevronDown
          size={16}
          className={`mt-0.5 shrink-0 text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Contenido colapsable */}
      {open && (
        <div className="border-t border-white/[0.04] flex flex-col gap-6 px-5 py-5">
          {scheme.meals?.map((meal, i) => <MealSlot key={i} meal={meal} />)}
        </div>
      )}
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function MiNutricion() {
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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
    <div className="min-h-[100dvh] bg-surface-900 pb-12">
      <SubpageHeader title="Mi nutrición" subtitle="Plan alimentario y objetivos" />

      {loading && <PageLoader label="Cargando tu plan..." />}

      {!loading && error && !plan && (
        <PanelEmpty
          icon={AlertCircle}
          tone="danger"
          title="No se pudo cargar el plan"
          description={error}
        />
      )}

      {!loading && !error && !plan && (
        <PanelEmpty
          icon={Utensils}
          title="Tu plan nutricional todavía no fue cargado"
          description="Cuando tu coach cargue tu plan alimentario, vas a verlo acá con sus macros y comidas."
        />
      )}

      {!loading && plan && (
        <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 pt-6">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Mi nutrición</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Plan actualizado por tu coach
              {plan.lastUpdate && (
                <> · {new Date(plan.lastUpdate).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}</>
              )}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MacroTile label="Calorías" value={plan.calories} unit="kcal" color="text-accent" />
            <MacroTile label="Proteínas" value={plan.protein} unit="g" color="text-emerald-400" />
            <MacroTile label="Carbohidratos" value={plan.carbs} unit="g" color="text-amber-400" />
            <MacroTile label="Grasas" value={plan.fat} unit="g" color="text-sky-400" />
          </div>

          {plan.notes && <CoachNote notes={plan.notes} />}

          {plan.meals?.length > 0 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-sm font-semibold text-white">
                Esquemas de dieta <span className="font-normal text-slate-600">({plan.meals.length})</span>
              </h2>
              {plan.meals.map((scheme, i) => (
                <SchemeSection key={i} scheme={scheme} index={i} defaultOpen={i === 0} />
              ))}
            </div>
          )}

          <BackToPanel />
        </div>
      )}
    </div>
  )
}
