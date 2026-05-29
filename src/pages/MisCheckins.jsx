import { useState, useEffect } from 'react'
import { ClipboardCheck, AlertCircle, MessageSquare } from 'lucide-react'
import { getMyCheckins } from '../services/checkinService'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { SubpageHeader, PanelEmpty, BackToPanel } from '../components/panel/PanelUI'

const DECISION_LABEL = {
  maintain: { text: 'Mantener', cls: 'bg-emerald-500/10 text-emerald-400' },
  adjust: { text: 'Ajustar', cls: 'bg-amber-500/10 text-amber-400' },
  review: { text: 'Revisar', cls: 'bg-rose-500/10 text-rose-400' },
}

// Escala 1-5 con puntos (solo si hay valor real)
function ScaleDots({ label, value }) {
  if (value == null) return null
  return (
    <div className="rounded-xl bg-white/[0.02] p-2.5 text-center">
      <div className="mb-1 text-[10px] text-slate-600">{label}</div>
      <div className="flex justify-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className={`h-1.5 w-1.5 rounded-full ${i <= value ? 'bg-accent' : 'bg-white/10'}`} />
        ))}
      </div>
    </div>
  )
}

function CheckinCard({ c }) {
  const dec = c.decision ? DECISION_LABEL[c.decision] : null
  const scales = [
    { label: 'Energía', value: c.energy },
    { label: 'Sueño', value: c.sleep },
    { label: 'Estrés', value: c.stress },
    { label: 'Hambre', value: c.hunger },
  ].filter((s) => s.value != null)

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-surface-800 p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-white">
            {c.date ? new Date(c.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Check-in'}
          </div>
          {c.weight != null && <div className="mt-0.5 text-xs text-slate-500">Peso: {c.weight} kg</div>}
        </div>
        {dec && (
          <span className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${dec.cls}`}>
            {dec.text}
          </span>
        )}
      </div>

      {scales.length > 0 && (
        <div className="mb-4 grid grid-cols-4 gap-2">
          {scales.map((s) => <ScaleDots key={s.label} label={s.label} value={s.value} />)}
        </div>
      )}

      {(c.nutritionAdherence != null || c.trainingAdherence != null) && (
        <div className="mb-4 flex gap-4 text-xs text-slate-500">
          {c.nutritionAdherence != null && <span>Nutrición: <strong className="text-slate-300">{c.nutritionAdherence}%</strong></span>}
          {c.trainingAdherence != null && <span>Entrenamiento: <strong className="text-slate-300">{c.trainingAdherence}%</strong></span>}
        </div>
      )}

      {c.clientComment && (
        <p className="mb-3 text-sm leading-relaxed text-slate-400">{c.clientComment}</p>
      )}

      {c.coachFeedback && (
        <div className="rounded-xl border border-accent/10 bg-accent/[0.06] p-3.5">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-accent">
            <MessageSquare size={12} /> Feedback de tu coach
          </div>
          <p className="text-sm leading-relaxed text-slate-300">{c.coachFeedback}</p>
        </div>
      )}
    </div>
  )
}

export default function MisCheckins() {
  const [checkins, setCheckins] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getMyCheckins()
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        setCheckins(Array.isArray(data) ? data : [])
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-[100dvh] bg-surface-900 pb-12">
      <SubpageHeader title="Check-ins" subtitle="Historial semanal y registro" />

      {loading && <PageLoader label="Cargando tus check-ins..." />}

      {!loading && error && (
        <PanelEmpty
          icon={AlertCircle}
          tone="danger"
          title="No se pudieron cargar tus check-ins"
          description={error}
        />
      )}

      {!loading && !error && checkins.length === 0 && (
        <PanelEmpty
          icon={ClipboardCheck}
          tone="accent"
          title="Aún no registraste check-ins"
          description="Cuando registres tu primer check-in semanal, vas a ver acá tu historial completo y la evolución de tus sensaciones y adherencia."
        />
      )}

      {!loading && !error && checkins.length > 0 && (
        <div className="mx-auto flex max-w-2xl flex-col gap-5 px-4 pt-6">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Mis check-ins</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {checkins.length} {checkins.length === 1 ? 'registro' : 'registros'} · más reciente primero
            </p>
          </div>

          {checkins.map((c) => <CheckinCard key={c.id ?? c.date} c={c} />)}

          <BackToPanel />
        </div>
      )}
    </div>
  )
}
