import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, subtitle, children, width = 'max-w-5xl' }) {
  useEffect(() => {
    if (!open) return undefined
    const close = (event) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', close)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', close)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 p-3 backdrop-blur-sm sm:p-8" onMouseDown={onClose}>
      <div className={`my-auto w-full ${width} rounded-2xl border border-white/[0.08] bg-[#111118] shadow-2xl`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 rounded-t-2xl border-b border-white/[0.06] bg-[#111118]/95 px-5 py-4 backdrop-blur">
          <div>
            <h2 className="font-semibold text-white">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-white/[0.05] hover:text-white" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
