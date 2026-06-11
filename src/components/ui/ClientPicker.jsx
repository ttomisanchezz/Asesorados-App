/**
 * Selector horizontal de asesorados para las vistas del coach
 * (Nutrición, Entrenamiento, Progreso). Scrollable en mobile.
 */
export default function ClientPicker({ clients, selectedId, onSelect }) {
  if (!clients?.length) return null
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
      {clients.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all shrink-0 ${
            selectedId === c.id
              ? 'bg-accent/15 text-accent border border-accent/25'
              : 'bg-[#111118] text-slate-400 border border-white/[0.06] hover:text-white'
          }`}
        >
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-semibold"
            style={{ backgroundColor: (c.avatarColor || '#6c63ff') + '33', color: c.avatarColor || '#8b85ff' }}
          >
            {c.avatar}
          </div>
          {c.name?.split(' ')[0] || 'Asesorado'}
        </button>
      ))}
    </div>
  )
}
