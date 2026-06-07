// ---------------------------------------------------------------------------
// groupPhotosByDay — agrupa las fotos de check-in por día de carga (fecha local,
// no UTC crudo). Reutiliza localDayKey del agrupador de comidas para mantener un
// único criterio de "día local" en toda la app.
//
// Devuelve los días del más reciente al más antiguo; dentro de cada día, las
// fotos también de la más reciente a la más antigua.
// ---------------------------------------------------------------------------
import { localDayKey } from './foodLogs'

export function groupPhotosByDay(photos) {
  const byDay = new Map()
  for (const p of photos ?? []) {
    const when = p.created_at || p.taken_at
    if (!when) continue
    const key = localDayKey(when)
    if (!byDay.has(key)) byDay.set(key, [])
    byDay.get(key).push(p)
  }
  return [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1)) // día más reciente primero
    .map(([key, items]) => ({
      key,
      date: new Date(`${key}T00:00:00`), // medianoche local de ese día
      photos: items.sort(
        (a, b) => new Date(b.created_at || b.taken_at) - new Date(a.created_at || a.taken_at),
      ),
    }))
}
