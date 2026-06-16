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

// Minúsculas y sin acentos, para comparar nombres de día sin sorpresas de locale.
const strip = (s) => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

// ---------------------------------------------------------------------------
// enumerateMeals — aplana las comidas del plan normalizado a una lista con una
// clave estable por comida ("schemeIndex:mealIndex") y marca cuáles son "de hoy"
// (las que cuentan para el % de cumplimiento del día):
//   - plan diario (un esquema)     → todas las comidas son de hoy.
//   - plan semanal (días)          → solo las del esquema del día de hoy; si hoy
//                                     no figura en el plan, no hay comidas de hoy.
//   - varios esquemas no-semanales → todas (no se sabe cuál aplica hoy).
// `todayTotal` es el denominador honesto del % del día.
// ---------------------------------------------------------------------------
export function enumerateMeals(mealPlan, date = new Date()) {
  if (!mealPlan || mealPlan.type === 'empty' || mealPlan.type === 'plain') {
    return { meals: [], todayTotal: 0 }
  }

  const schemes = mealPlan.schemes ?? []

  // Para planes semanales: índice del esquema cuyo nombre arranca con el día de hoy.
  let todaySchemeIdx = -1
  if (mealPlan.weekly) {
    const todayName = strip(date.toLocaleDateString('es-AR', { weekday: 'long' }))
    todaySchemeIdx = schemes.findIndex((s) => strip(s.scheme).startsWith(todayName))
  }

  const meals = []
  schemes.forEach((s, schemeIndex) => {
    s.meals.forEach((m, mealIndex) => {
      const today = mealPlan.weekly ? schemeIndex === todaySchemeIdx : true
      meals.push({
        key: `${schemeIndex}:${mealIndex}`,
        schemeIndex,
        mealIndex,
        schemeLabel: s.scheme || '',
        mealName: m.name || '',
        today,
      })
    })
  })

  return { meals, todayTotal: meals.filter((m) => m.today).length }
}
