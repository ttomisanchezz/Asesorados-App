import { useState, useEffect, useRef, useCallback } from 'react'
import {
  ClipboardCheck, AlertCircle, MessageSquare, Camera, Trash2, Loader2, ImageOff,
} from 'lucide-react'
import { getMyCheckins } from '../services/checkinService'
import {
  getMyCheckinPhotos, uploadCheckinPhoto, deleteCheckinPhoto,
} from '../services/photoService'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { SubpageHeader, PanelEmpty, BackToPanel } from '../components/panel/PanelUI'

const DECISION_LABEL = {
  maintain: { text: 'Mantener', cls: 'bg-emerald-500/10 text-emerald-400' },
  adjust: { text: 'Ajustar', cls: 'bg-amber-500/10 text-amber-400' },
  review: { text: 'Revisar', cls: 'bg-rose-500/10 text-rose-400' },
}

const POSES = [
  { value: 'frente', label: 'Frente' },
  { value: 'perfil', label: 'Perfil' },
  { value: 'espalda', label: 'Espalda' },
]

// Traduce errores técnicos del upload a algo accionable para el asesorado.
function friendlyUploadError(error, reason) {
  if (reason === 'no-client') {
    return 'No encontramos tu perfil de asesorado vinculado. Contactá a tu coach.'
  }
  const m = error?.message || ''
  if (/bucket not found/i.test(m)) {
    return 'El almacenamiento de fotos no está disponible todavía. Avisale a tu coach.'
  }
  if (/payload too large|exceeded the maximum|413/i.test(m)) {
    return 'La imagen es demasiado grande. Probá con una foto más liviana.'
  }
  if (/row-level security|permission|policy/i.test(m)) {
    return 'No se pudo guardar por permisos. Avisale a tu coach.'
  }
  return m || 'No se pudo subir la foto.'
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

// ── Miniatura con botón de borrar ────────────────────────────────────────────
function PhotoThumb({ photo, onDelete, deleting }) {
  const poseLabel = POSES.find((p) => p.value === photo.pose)?.label
  return (
    <div className="group relative aspect-square overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
      {photo.url ? (
        <img src={photo.url} alt={poseLabel || 'Foto de progreso'} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-slate-600">
          <ImageOff size={20} />
        </div>
      )}
      {poseLabel && (
        <span className="absolute left-1.5 top-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
          {poseLabel}
        </span>
      )}
      <button
        type="button"
        onClick={() => onDelete(photo.id)}
        disabled={deleting}
        aria-label="Borrar foto"
        className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 text-rose-300 backdrop-blur-sm transition-colors hover:bg-rose-500/80 hover:text-white disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60"
      >
        {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
      </button>
    </div>
  )
}

// ── Bloque: subir fotos de progreso ──────────────────────────────────────────
function PhotoUploadBlock() {
  const [photos, setPhotos] = useState([])
  const [pose, setPose] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [msg, setMsg] = useState(null)
  const inputRef = useRef(null)

  const load = useCallback(() => {
    return getMyCheckinPhotos().then(({ data }) => setPhotos(data ?? []))
  }, [])

  useEffect(() => { load() }, [load])

  async function handleFiles(e) {
    const picked = Array.from(e.target.files ?? [])
    if (inputRef.current) inputRef.current.value = '' // permite resubir el mismo archivo
    if (picked.length === 0) return

    // Solo imágenes: el picker filtra con accept, pero algunos orígenes lo saltean.
    const files = picked.filter((f) => f.type?.startsWith('image/'))
    const skipped = picked.length - files.length
    if (files.length === 0) {
      setMsg({ type: 'error', text: 'Elegí archivos de imagen (JPG, PNG, etc.).' })
      return
    }

    setMsg(null)
    setUploading(true)

    // Cada foto se sube por separado: si una falla, las demás igual entran.
    let ok = 0
    let firstError = null
    for (const file of files) {
      const { error, reason } = await uploadCheckinPhoto(file, { pose })
      if (error) {
        firstError = firstError || { error, reason }
      } else {
        ok += 1
      }
    }

    setUploading(false)
    if (ok > 0) await load()

    if (firstError) {
      const detail = friendlyUploadError(firstError.error, firstError.reason)
      setMsg({
        type: ok > 0 ? 'warn' : 'error',
        text: ok > 0 ? `Subimos ${ok} foto(s), pero alguna falló: ${detail}` : detail,
      })
    } else {
      const extra = skipped > 0 ? ` (${skipped} archivo(s) no eran imágenes y se omitieron)` : ''
      setMsg({ type: 'ok', text: `${ok} foto(s) subida(s).${extra}` })
    }
  }

  async function handleDelete(id) {
    setDeletingId(id)
    const { error } = await deleteCheckinPhoto(id)
    setDeletingId(null)
    if (error) {
      setMsg({ type: 'error', text: error.message || 'No se pudo borrar la foto.' })
      return
    }
    setPhotos((prev) => prev.filter((p) => p.id !== id))
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/[0.06] bg-surface-800 px-5 py-5">
      <div>
        <h3 className="text-sm font-semibold text-white">Fotos de progreso</h3>
        <p className="mt-0.5 text-xs text-slate-500">Cargá tus fotos de frente, perfil y espalda para comparar avances semana a semana.</p>
      </div>

      {/* Selector de pose (opcional) */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500">Pose:</span>
        {POSES.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setPose((cur) => (cur === p.value ? null : p.value))}
            aria-pressed={pose === p.value}
            className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
              pose === p.value
                ? 'border-accent/40 bg-accent/15 text-accent'
                : 'border-white/[0.06] bg-white/[0.02] text-slate-400 hover:text-white'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Control de subida */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFiles}
        disabled={uploading}
        className="hidden"
        id="checkin-photo-input"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex items-center justify-center gap-2 rounded-xl border border-accent/25 bg-accent/[0.08] py-3 text-sm font-semibold text-accent transition-all hover:bg-accent/[0.14] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        {uploading ? <><Loader2 size={16} className="animate-spin" /> Subiendo…</> : <><Camera size={16} /> Subir fotos</>}
      </button>

      {msg && (
        <div
          className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm ${
            msg.type === 'ok'
              ? 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-300'
              : msg.type === 'warn'
                ? 'border-amber-500/20 bg-amber-500/[0.06] text-amber-300'
                : 'border-rose-500/20 bg-rose-500/[0.06] text-rose-300'
          }`}
        >
          {msg.type === 'ok' ? <Camera size={15} className="shrink-0" /> : <AlertCircle size={15} className="shrink-0" />}
          {msg.text}
        </div>
      )}

      {/* Galería de miniaturas */}
      {photos.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((p) => (
            <PhotoThumb key={p.id} photo={p} onDelete={handleDelete} deleting={deletingId === p.id} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-600">Todavía no subiste fotos.</p>
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
      <SubpageHeader title="Check-ins" subtitle="Subí tus fotos de progreso para que tu coach siga tu evolución." />

      {loading && <PageLoader label="Cargando tus check-ins..." />}

      {!loading && error && (
        <PanelEmpty
          icon={AlertCircle}
          tone="danger"
          title="No se pudieron cargar tus check-ins"
          description={error}
        />
      )}

      {!loading && !error && (
        <div className="mx-auto flex max-w-2xl flex-col gap-5 px-4 pt-6">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Mis check-ins</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {checkins.length > 0
                ? `${checkins.length} ${checkins.length === 1 ? 'registro' : 'registros'} · más reciente primero`
                : 'Subí tus fotos de progreso y seguí tu historial'}
            </p>
          </div>

          {/* Subida de fotos del asesorado */}
          <PhotoUploadBlock />

          {/* Historial de check-ins */}
          {checkins.length > 0 ? (
            checkins.map((c) => <CheckinCard key={c.id ?? c.date} c={c} />)
          ) : (
            <div className="rounded-2xl border border-white/[0.06] bg-surface-800 px-5 py-6 text-center">
              <ClipboardCheck size={26} className="mx-auto mb-2 text-slate-500" strokeWidth={1.75} />
              <p className="text-sm font-medium text-white">Aún no registraste check-ins</p>
              <p className="mt-1 text-xs text-slate-500">
                Cuando tu coach registre tu primer check-in semanal, vas a ver acá tu historial completo.
              </p>
            </div>
          )}

          <BackToPanel />
        </div>
      )}
    </div>
  )
}
