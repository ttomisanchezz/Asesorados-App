// ---------------------------------------------------------------------------
// normalizeMealPlan — lleva el plan de comidas guardado en DB a una vista
// uniforme para la UI, sin inventar nada. La DB guarda `meals` como:
//   [{ scheme, description, meals: [{ name, options: [{ title, items[], kcal, macros }] }] }]
//
// type:
//   'grouped' → varios esquemas (días de la semana, entreno/descanso, varias
//               dietas) → acordeón por esquema → acordeón por comida.
//   'daily'   → un solo esquema → acordeón por comida directo.
//   'plain'   → el plan vino como texto libre.
//   'empty'   → sin comidas cargadas.
// ---------------------------------------------------------------------------

const DAY_RE = /^(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/i

export function normalizeMealPlan(plan) {
  const meals = plan?.meals

  // Texto libre (formato alternativo)
  if (typeof meals === 'string') {
    const text = meals.trim()
    return text ? { type: 'plain', text, weekly: false, schemes: [] } : empty()
  }

  if (!Array.isArray(meals) || meals.length === 0) return empty()

  // Esquemas válidos: con al menos una comida que tenga opciones.
  const schemes = meals
    .filter((s) => s && Array.isArray(s.meals))
    .map((s) => ({
      scheme: s.scheme || '',
      description: s.description || '',
      meals: s.meals.filter((m) => m && Array.isArray(m.options) && m.options.length > 0),
    }))
    .filter((s) => s.meals.length > 0)

  if (!schemes.length) return empty()

  // weekly = todos los esquemas son días de la semana (santi). Solo afecta el rótulo.
  const weekly = schemes.every((s) => DAY_RE.test(s.scheme))
  return { type: schemes.length > 1 ? 'grouped' : 'daily', weekly, schemes }
}

function empty() {
  return { type: 'empty', weekly: false, schemes: [] }
}
