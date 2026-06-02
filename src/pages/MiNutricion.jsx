import { useState, useEffect, useCallback } from 'react'
import {
  Utensils, Zap, AlertCircle, ChevronDown,
  CheckCircle2, MinusCircle, CircleSlash, Plus, Check, Loader2, Clock,
} from 'lucide-react'
import {
  getMyNutritionPlan, upsertCompliance, getMyCompliance, addFoodLog, getMyFoodLogs,
} from '../services/nutritionService'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { SubpageHeader, PanelEmpty, BackToPanel } from '../components/panel/PanelUI'

const NOTES_PREVIEW_LIMIT = 140

// Fecha local YYYY-MM-DD (coincide con la que guarda el service).
function todayLocalDate() {
  const d = new Date()
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10)
}

const COMPLIANCE_OPTIONS = [
  {
    value: 'cumplido', label: 'Cumplí', icon: CheckCircle2,
    active: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
    badge: 'bg-emerald-500/10 text-emerald-400',
  },
  {
    value: 'parcial', label: 'A medias', icon: MinusCircle,
    active: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
    badge: 'bg-amber-500/10 text-amber-400',
  },
  {
    value: 'no_cumplido', label: 'No cumplí', icon: CircleSlash,
    active: 'border-rose-500/40 bg-rose-500/15 text-rose-300',
    badge: 'bg-rose-500/10 text-rose-400',
  },
]

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

// ── Bloque: ¿Cumpliste el plan de hoy? ───────────────────────────────────────
function ComplianceBlock() {
  const [today, setToday] = useState(null) // fila de hoy si ya cargó
  const [selected, setSelected] = useState(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null) // { type, text }

  const load = useCallback(() => {
    return getMyCompliance(7).then(({ data }) => {
      const td = todayLocalDate()
      const row = (data ?? []).find((r) => r.log_date === td) || null
      setToday(row)
      if (row) {
        setSelected(row.status)
        setNote(row.note ?? '')
      }
    })
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSave() {
    if (!selected) {
      setMsg({ type: 'error', text: 'Elegí una opción primero.' })
      return
    }
    setMsg(null)
    setSaving(true)
    const { error, reason } = await upsertCompliance({ status: selected, note })
    setSaving(false)
    if (error) {
      setMsg({
        type: 'error',
        text: reason === 'no-client'
          ? 'No encontramos tu perfil de asesorado vinculado. Contactá a tu coach.'
          : error.message || 'No se pudo guardar.',
      })
      return
    }
    setMsg({ type: 'ok', text: today ? 'Cumplimiento actualizado.' : 'Cumplimiento registrado.' })
    load()
  }

  const todayOpt = today ? COMPLIANCE_OPTIONS.find((o) => o.value === today.status) : null

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/[0.06] bg-surface-800 px-5 py-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">¿Cumpliste el plan de hoy?</h3>
        {todayOpt && (
          <span className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${todayOpt.badge}`}>
            Hoy: {todayOpt.label}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {COMPLIANCE_OPTIONS.map((opt) => {
          const Icon = opt.icon
          const isActive = selected === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSelected(opt.value)}
              aria-pressed={isActive}
              className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-semibold transition-all min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
                isActive
                  ? opt.active
                  : 'border-white/[0.06] bg-white/[0.02] text-slate-400 hover:text-white hover:border-white/[0.12]'
              }`}
            >
              <Icon size={18} />
              {opt.label}
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="compliance-note" className="text-xs text-slate-500">Comentario (opcional)</label>
        <input
          id="compliance-note"
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ej: me salté la colación de la tarde…"
          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/40"
        />
      </div>

      {msg && (
        <div
          className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm ${
            msg.type === 'ok'
              ? 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-300'
              : 'border-rose-500/20 bg-rose-500/[0.06] text-rose-300'
          }`}
        >
          {msg.type === 'ok' ? <Check size={15} className="shrink-0" /> : <AlertCircle size={15} className="shrink-0" />}
          {msg.text}
        </div>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white shadow-glow transition-all hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        {saving ? <><Loader2 size={16} className="animate-spin" /> Guardando…</> : (today ? 'Actualizar cumplimiento' : 'Guardar cumplimiento')}
      </button>
    </div>
  )
}

// ── Bloque: agregar comida + lista de comidas recientes ──────────────────────
function FoodLogBlock() {
  const [logs, setLogs] = useState([])
  const [description, setDescription] = useState('')
  const [mealLabel, setMealLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const load = useCallback(() => {
    return getMyFoodLogs(20).then(({ data }) => setLogs(data ?? []))
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSave() {
    if (!description.trim()) {
      setMsg({ type: 'error', text: 'Escribí qué comiste.' })
      return
    }
    setMsg(null)
    setSaving(true)
    const { data, error, reason } = await addFoodLog({ description, mealLabel })
    setSaving(false)
    if (error) {
      setMsg({
        type: 'error',
        text: reason === 'no-client'
          ? 'No encontramos tu perfil de asesorado vinculado. Contactá a tu coach.'
          : error.message || 'No se pudo guardar la comida.',
      })
      return
    }
    // Aparece al instante en la lista.
    setLogs((prev) => [data, ...prev])
    setDescription('')
    setMealLabel('')
    setMsg({ type: 'ok', text: 'Comida registrada.' })
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/[0.06] bg-surface-800 px-5 py-5">
      <h3 className="text-sm font-semibold text-white">Agregar comida</h3>

      <div className="flex flex-col gap-3">
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="¿Qué comiste? Ej: 2 huevos revueltos con palta"
          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/40"
        />
        <input
          type="text"
          value={mealLabel}
          onChange={(e) => setMealLabel(e.target.value)}
          placeholder="Momento (opcional): Desayuno, Colación…"
          aria-label="Momento de la comida (opcional)"
          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/40"
        />
      </div>

      {msg && (
        <div
          className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm ${
            msg.type === 'ok'
              ? 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-300'
              : 'border-rose-500/20 bg-rose-500/[0.06] text-rose-300'
          }`}
        >
          {msg.type === 'ok' ? <Check size={15} className="shrink-0" /> : <AlertCircle size={15} className="shrink-0" />}
          {msg.text}
        </div>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white shadow-glow transition-all hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        {saving ? <><Loader2 size={16} className="animate-spin" /> Guardando…</> : <><Plus size={16} /> Guardar comida</>}
      </button>

      {/* Lista de comidas recientes */}
      {logs.length > 0 && (
        <div className="mt-1 flex flex-col gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Comidas recientes</h4>
          {logs.map((log) => (
            <FoodLogRow key={log.id} log={log} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Fila de comida registrada ────────────────────────────────────────────────
function FoodLogRow({ log }) {
  const when = log.logged_at
    ? new Date(log.logged_at).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-white/[0.04] bg-white/[0.02] p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        {log.meal_label && (
          <span className="rounded-md bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
            {log.meal_label}
          </span>
        )}
        <span className="text-sm font-medium leading-snug text-white">{log.description}</span>
      </div>
      {when && (
        <div className="flex items-center gap-1 text-[11px] text-slate-600">
          <Clock size={11} /> {when}
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
      <SubpageHeader title="Mi nutrición" subtitle="Plan alimentario y registro diario" />

      {loading && <PageLoader label="Cargando tu plan..." />}

      {!loading && error && (
        <PanelEmpty
          icon={AlertCircle}
          tone="danger"
          title="No se pudo cargar el plan"
          description={error}
        />
      )}

      {!loading && !error && (
        <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 pt-6">
          {plan ? (
            <>
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
            </>
          ) : (
            <div className="rounded-2xl border border-white/[0.06] bg-surface-800 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.04]">
                  <Utensils size={16} className="text-slate-400" />
                </span>
                <p className="text-sm text-slate-400">
                  Tu coach todavía no cargó tu plan. Igual podés registrar tu cumplimiento y tus comidas.
                </p>
              </div>
            </div>
          )}

          {/* Registro diario del asesorado */}
          <ComplianceBlock />
          <FoodLogBlock />

          <BackToPanel />
        </div>
      )}
    </div>
  )
}
