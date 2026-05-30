import { useState, useEffect, useCallback } from 'react'
import {
  TrendingUp, TrendingDown, Minus, AlertCircle, Plus, Check, Loader2, Scale,
} from 'lucide-react'
import { getMyClientProfile } from '../services/clientService'
import { getMyProgress, addMyProgressEntry } from '../services/progressService'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { SubpageHeader, PanelEmpty, BackToPanel } from '../components/panel/PanelUI'

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })

// ── Gráfico de evolución (SVG, sin dependencias) ─────────────────────────────
function WeightChart({ points }) {
  const W = 320
  const H = 120
  const pad = 10
  const n = points.length
  const weights = points.map((p) => p.weight)
  const min = Math.min(...weights)
  const max = Math.max(...weights)
  const range = max - min || 1
  const x = (i) => pad + (i * (W - 2 * pad)) / (n - 1 || 1)
  const y = (w) => H - pad - ((w - min) / range) * (H - 2 * pad)

  const linePts = points.map((p, i) => `${x(i)},${y(p.weight)}`).join(' ')
  const areaPts = `${x(0)},${H - pad} ${linePts} ${x(n - 1)},${H - pad}`
  const last = points[n - 1]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="wgrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6c63ff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#6c63ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Área */}
      <polygon points={areaPts} fill="url(#wgrad)" />
      {/* Línea */}
      <polyline
        points={linePts}
        fill="none"
        stroke="#8b85ff"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* Punto final destacado */}
      <circle cx={x(n - 1)} cy={y(last.weight)} r="3.5" fill="#6c63ff" stroke="#0a0a0f" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

// ── Historial de registros (lista descendente por fecha) ────────────────────
function HistoryCard({ points }) {
  const [showAll, setShowAll] = useState(false)
  // points viene ascendente; la lista la mostramos del más reciente al más antiguo.
  const desc = [...points].reverse()
  const visible = showAll ? desc : desc.slice(0, 6)

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-surface-800 p-5">
      <div className="mb-3">
        <div className="text-sm font-semibold text-white">Historial de registros</div>
        <div className="mt-0.5 text-xs text-slate-500">Peso registrado por fecha</div>
      </div>

      <div className={showAll ? 'max-h-80 overflow-y-auto pr-1' : ''}>
        {visible.map((p, i) => (
          <div
            key={`${p.iso}-${i}`}
            className="flex items-center justify-between border-b border-white/[0.04] py-2.5 last:border-0"
          >
            <span className="text-sm text-slate-400">{fmtDate(p.iso)}</span>
            <span className="text-sm font-semibold tabular-nums text-white">{p.weight} kg</span>
          </div>
        ))}
      </div>

      {desc.length > 6 && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 w-full rounded-xl border border-white/[0.06] py-2.5 text-xs font-medium text-accent transition-colors hover:bg-white/[0.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          {showAll ? 'Ver menos' : `Ver todos (${desc.length})`}
        </button>
      )}
    </div>
  )
}

// ── Tile de estadística de peso ──────────────────────────────────────────────
function StatTile({ label, value, sub, valueClass = 'text-white', icon: Icon, unit }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-surface-800 p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 flex items-center gap-1 text-2xl font-bold leading-none ${valueClass}`}>
        {Icon && <Icon size={18} strokeWidth={2} />}
        {value}
        {unit && <span className="ml-1 text-sm font-medium text-slate-500">{unit}</span>}
      </div>
      {sub && <div className="mt-1 text-[11px] text-slate-600">{sub}</div>}
    </div>
  )
}

function AdherenceBar({ label, value }) {
  const color = value >= 85 ? 'bg-emerald-500' : value >= 65 ? 'bg-amber-500' : 'bg-rose-500'
  const textColor = value >= 85 ? 'text-emerald-400' : value >= 65 ? 'text-amber-400' : 'text-rose-400'
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">{label}</span>
        <span className={`text-sm font-bold ${textColor}`}>{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  )
}

// ── Formulario "Actualizar mi peso" ──────────────────────────────────────────
function WeightForm({ onSaved }) {
  const today = new Date().toISOString().slice(0, 10)
  const [open, setOpen] = useState(false)
  const [weight, setWeight] = useState('')
  const [date, setDate] = useState(today)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null) // { type: 'ok'|'error', text }

  async function handleSave() {
    setMsg(null)
    const w = parseFloat(String(weight).replace(',', '.'))
    if (!weight || Number.isNaN(w)) return setMsg({ type: 'error', text: 'Ingresá un peso válido.' })
    if (w < 30 || w > 250) return setMsg({ type: 'error', text: 'El peso debe estar entre 30 y 250 kg.' })
    if (!date) return setMsg({ type: 'error', text: 'Elegí una fecha.' })

    setSaving(true)
    const { error, updated } = await addMyProgressEntry({
      weight: Math.round(w * 100) / 100,
      date,
      notes: note.trim() || undefined,
    })
    setSaving(false)

    if (error) {
      const denied = error.code === '42501' || /row-level security|permission|policy/i.test(error.message || '')
      setMsg({
        type: 'error',
        text: denied
          ? 'Tu cuenta todavía no tiene permiso para registrar peso. Avisale a tu coach.'
          : error.message || 'No se pudo guardar el registro.',
      })
      return
    }

    setMsg({ type: 'ok', text: updated ? 'Registro actualizado para esa fecha.' : 'Peso guardado correctamente.' })
    setWeight('')
    setNote('')
    onSaved?.()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-center gap-2 rounded-2xl border border-accent/25 bg-accent/[0.08] p-4 text-sm font-semibold text-accent transition-all hover:bg-accent/[0.14] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        <Plus size={16} /> Cargar peso
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/[0.06] bg-surface-800 p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10">
          <Scale size={17} className="text-accent" strokeWidth={1.75} />
        </div>
        <div>
          <div className="text-sm font-semibold text-white">Actualizar mi peso</div>
          <div className="mt-0.5 text-xs text-slate-500">Registrá tu peso para mantener tu evolución actualizada.</div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {/* Peso */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="peso" className="text-xs text-slate-500">Peso (kg)</label>
          <input
            id="peso"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="30"
            max="250"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="80.6"
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-lg font-semibold text-white outline-none transition-colors placeholder:text-slate-600 focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/40"
          />
        </div>

        {/* Fecha */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="fecha" className="text-xs text-slate-500">Fecha</label>
          <input
            id="fecha"
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition-colors focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/40 [color-scheme:dark]"
          />
        </div>

        {/* Nota opcional */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="nota" className="text-xs text-slate-500">Nota (opcional)</label>
          <input
            id="nota"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Cómo te sentís, contexto…"
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/40"
          />
        </div>
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

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white shadow-glow transition-all hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          {saving ? <><Loader2 size={16} className="animate-spin" /> Guardando…</> : 'Guardar registro'}
        </button>
        <button
          onClick={() => { setOpen(false); setMsg(null) }}
          disabled={saving}
          className="rounded-xl border border-white/[0.08] px-4 py-3 text-sm text-slate-400 transition-colors hover:text-white disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          Cerrar
        </button>
      </div>
    </div>
  )
}

export default function MiProgreso() {
  const [client, setClient] = useState(null)
  const [progress, setProgress] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadData = useCallback(async () => {
    const [profile, prog] = await Promise.allSettled([getMyClientProfile(), getMyProgress()])
    if (profile.status === 'fulfilled') {
      if (profile.value?.error) setError(profile.value.error.message)
      setClient(profile.value?.data ?? null)
    } else {
      setError('No se pudo cargar tu perfil')
    }
    setProgress(prog.status === 'fulfilled' ? (prog.value?.data ?? null) : null)
  }, [])

  useEffect(() => {
    Promise.resolve().then(loadData).finally(() => setLoading(false))
  }, [loadData])

  // ── Derivados de la serie real (ascendente por fecha) ──────────────────────
  const pts = progress?.points ?? []
  const hasHistory = pts.length > 0
  const first = pts[0] ?? null
  const last = pts[pts.length - 1] ?? null
  const initialW = first?.weight ?? null
  const currentW = last?.weight ?? (client?.weight ?? null)
  const change = initialW != null && currentW != null ? Math.round((currentW - initialW) * 10) / 10 : null
  const minW = hasHistory ? Math.min(...pts.map((p) => p.weight)) : null
  const maxW = hasHistory ? Math.max(...pts.map((p) => p.weight)) : null

  const hasAdherence = client && (client.adherenceNutrition > 0 || client.adherenceTraining > 0)
  const hasMetrics =
    (client && (client.weight || client.targetWeight || client.height || hasAdherence)) || hasHistory

  return (
    <div className="min-h-[100dvh] bg-surface-900 pb-12">
      <SubpageHeader title="Mi progreso" subtitle="Peso, medidas y evolución" />

      {loading && <PageLoader label="Cargando tu progreso..." />}

      {!loading && error && !hasMetrics && (
        <PanelEmpty icon={AlertCircle} tone="danger" title="No se pudo cargar tu progreso" description={error} />
      )}

      {!loading && !error && !hasMetrics && (
        <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 pt-6">
          <PanelEmpty
            icon={TrendingUp}
            title="Todavía no hay métricas suficientes para mostrar tu progreso"
            description="Cargá tu primer peso para empezar a ver tu evolución acá."
          />
          <WeightForm onSaved={loadData} />
          <BackToPanel />
        </div>
      )}

      {!loading && hasMetrics && (
        <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 pt-6">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Mi progreso</h1>
            <p className="mt-0.5 text-sm text-slate-500">Tu evolución de peso, medidas y adherencia</p>
          </div>

          {/* Resumen de peso: inicial / actual / cambio */}
          {hasHistory && (
            <div className="grid grid-cols-3 gap-3">
              <StatTile label="Peso inicial" value={`${initialW}`} unit="kg" sub={first ? fmtDate(first.iso) : undefined} />
              <StatTile label="Peso actual" value={`${currentW}`} unit="kg" valueClass="text-white" sub={last ? fmtDate(last.iso) : undefined} />
              <StatTile
                label="Cambio total"
                value={change > 0 ? `+${change}` : `${change}`}
                unit="kg"
                valueClass={change < 0 ? 'text-emerald-400' : change > 0 ? 'text-amber-400' : 'text-slate-300'}
                icon={change < 0 ? TrendingDown : change > 0 ? TrendingUp : Minus}
                sub="desde el inicio"
              />
            </div>
          )}

          {/* Gráfico de evolución */}
          {hasHistory && (
            <div className="rounded-2xl border border-white/[0.06] bg-surface-800 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm font-semibold text-white">Evolución de peso</div>
                <div className="text-xs text-slate-500">{progress.count} registros</div>
              </div>

              <WeightChart points={pts} />

              <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
                <span>{first ? fmtDate(first.iso) : ''}</span>
                <span className="text-slate-500">Mín {minW} · Máx {maxW} kg</span>
                <span>{last ? fmtDate(last.iso) : ''}</span>
              </div>
            </div>
          )}

          {/* Historial de registros (lista descendente) */}
          {hasHistory && <HistoryCard points={pts} />}

          {/* Cargar nuevo peso */}
          <WeightForm onSaved={loadData} />

          {/* Objetivo / altura (de la ficha del cliente) */}
          {client && (client.targetWeight || client.height) && (
            <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-surface-800">
              <div className="border-b border-white/[0.04] px-5 pb-3 pt-5">
                <div className="text-sm font-semibold text-white">Objetivo</div>
              </div>
              <div className="px-5 py-2">
                {client.targetWeight && (
                  <div className="flex items-center justify-between border-b border-white/[0.04] py-3.5 last:border-0">
                    <div className="text-sm text-slate-400">Peso objetivo</div>
                    <div className="text-lg font-bold text-accent">{client.targetWeight} kg</div>
                  </div>
                )}
                {currentW != null && client.targetWeight && (
                  <div className="flex items-center justify-between border-b border-white/[0.04] py-3.5 last:border-0">
                    <div>
                      <div className="text-sm text-slate-400">Falta para el objetivo</div>
                      <div className="mt-0.5 text-xs text-slate-600">
                        {client.targetWeight < currentW ? 'por bajar' : client.targetWeight > currentW ? 'por subir' : 'objetivo alcanzado'}
                      </div>
                    </div>
                    <div className="text-lg font-bold text-slate-300">
                      {Math.abs(client.targetWeight - currentW).toFixed(1)} kg
                    </div>
                  </div>
                )}
                {client.height && (
                  <div className="flex items-center justify-between border-b border-white/[0.04] py-3.5 last:border-0">
                    <div className="text-sm text-slate-400">Altura</div>
                    <div className="text-lg font-bold text-slate-300">{client.height} cm</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Medidas corporales (si el último registro las tiene) */}
          {progress?.measurements && Object.values(progress.measurements).some((v) => v != null) && (
            <div className="rounded-2xl border border-white/[0.06] bg-surface-800 p-5">
              <div className="mb-4 text-sm font-semibold text-white">Últimas medidas</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Cintura', value: progress.measurements.waist },
                  { label: 'Pecho', value: progress.measurements.chest },
                  { label: 'Cadera', value: progress.measurements.hip },
                  { label: 'Brazo', value: progress.measurements.arm },
                  { label: 'Pierna', value: progress.measurements.leg },
                ]
                  .filter((m) => m.value != null)
                  .map((m) => (
                    <div key={m.label} className="rounded-xl bg-white/[0.02] p-3 text-center">
                      <div className="mb-0.5 text-xs text-slate-500">{m.label}</div>
                      <div className="font-bold text-white">{m.value} cm</div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Adherencia */}
          {hasAdherence && (
            <div className="flex flex-col gap-4 rounded-2xl border border-white/[0.06] bg-surface-800 p-5">
              <div className="text-sm font-semibold text-white">Adherencia semanal</div>
              <AdherenceBar label="Nutrición" value={client.adherenceNutrition} />
              <AdherenceBar label="Entrenamiento" value={client.adherenceTraining} />
            </div>
          )}

          <BackToPanel />
        </div>
      )}
    </div>
  )
}
