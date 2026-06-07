// ---------------------------------------------------------------------------
// Helpers puros para agrupar las comidas del asesorado por día.
// Sin dependencias de React ni de Supabase → fáciles de testear en aislamiento.
// ---------------------------------------------------------------------------

// Clave de día local YYYY-MM-DD desde un timestamp. Usa componentes locales
// (getFullYear/Month/Date) para que una comida cargada de noche no se vaya al
// día siguiente por el corrimiento UTC.
export function localDayKey(dateLike) {
  const d = new Date(dateLike)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Agrupa las comidas en los últimos `days` días locales (hoy primero). Cada día
// trae sus comidas ordenadas de la más reciente a la más antigua.
export function groupLogsByDay(logs, days = 7) {
  const byDay = new Map()
  for (const log of logs ?? []) {
    const when = log.logged_at || log.created_at
    if (!when) continue
    const key = localDayKey(when)
    if (!byDay.has(key)) byDay.set(key, [])
    byDay.get(key).push(log)
  }
  const today = new Date()
  const out = []
  for (let i = 0; i < days; i++) {
    // new Date(y, m, d - i) normaliza el cruce de mes/año automáticamente.
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
    const key = localDayKey(date)
    const dayLogs = (byDay.get(key) ?? []).sort(
      (a, b) => new Date(b.logged_at || b.created_at) - new Date(a.logged_at || a.created_at),
    )
    out.push({ key, date, offset: i, logs: dayLogs })
  }
  return out
}
