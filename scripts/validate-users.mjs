#!/usr/bin/env node
// ---------------------------------------------------------------------------
// validate-users.mjs — Auditoría de "readiness" de TODOS los asesorados contra
// la base real. Valida, por usuario, que la app tenga todo lo necesario para
// mandarle el link y que cada pantalla tenga datos para renderizar.
//
// Chequea por cada asesorado:
//   - login      → clients.user_id no nulo (puede entrar)
//   - objetivo   → clients.objective cargado
//   - peso       → clients.weight cargado
//   - nutrición  → plan activo con macros (calories/protein/carbs/fats)
//   - rutina     → plan activo con ejercicios (anidados en days[].exercises)
//
// Sale con código != 0 si algún asesorado no está listo (sirve para CI).
//
// Uso:
//   SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...  node scripts/validate-users.mjs
//   (o `npm run test:data` con esas env vars exportadas)
//
// La service_role key NO está en .env.local (ahí solo va la anon, para el
// frontend). Pasala por variable de entorno; nunca la commitees.
// ---------------------------------------------------------------------------
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('✖ Faltan env vars: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY')
  console.error('  Ej: SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/validate-users.mjs')
  process.exit(2)
}

const sb = createClient(url, key, { auth: { persistSession: false } })

// Cuenta los ejercicios reales: viven anidados en days[].exercises, NO en la
// columna top-level workout_plans.exercises (que está vacía y sin uso).
function countExercises(days) {
  if (!Array.isArray(days)) return 0
  return days.reduce((acc, d) => acc + (Array.isArray(d?.exercises) ? d.exercises.length : 0), 0)
}

async function main() {
  const { data: clients, error } = await sb
    .from('clients')
    .select('id, full_name, user_id, objective, weight')
    .order('full_name')
  if (error) throw error

  const rows = []
  for (const c of clients) {
    const [{ data: nut }, { data: wk }] = await Promise.all([
      sb.from('nutrition_plans').select('calories, protein, carbs, fats')
        .eq('client_id', c.id).eq('active', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      sb.from('workout_plans').select('days')
        .eq('client_id', c.id).eq('active', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ])

    const login = c.user_id != null
    const objetivo = Boolean(c.objective)
    const peso = c.weight != null
    const macros = Boolean(nut && nut.calories != null && nut.protein != null && nut.carbs != null && nut.fats != null)
    const ejercicios = countExercises(wk?.days)
    const listo = login && objetivo && peso && macros && ejercicios > 0

    rows.push({ nombre: c.full_name, login, objetivo, peso, macros, ejercicios, listo })
  }

  const mark = (b) => (b ? '✅' : '⛔')
  console.log('\n  Asesorado'.padEnd(34) + 'login  obj  peso  macros  ejerc  →  estado')
  console.log('  ' + '─'.repeat(74))
  for (const r of rows) {
    console.log(
      '  ' + r.nombre.padEnd(30) +
      `  ${mark(r.login)}    ${mark(r.objetivo)}   ${mark(r.peso)}    ${mark(r.macros)}     ` +
      String(r.ejercicios).padStart(3) + '    ' + (r.listo ? '✅ LISTO' : '⛔ FALTA'),
    )
  }

  const noListos = rows.filter((r) => !r.listo)
  console.log('\n  ' + (rows.length - noListos.length) + '/' + rows.length + ' asesorados listos para el link.\n')
  if (noListos.length) {
    console.error('✖ No listos: ' + noListos.map((r) => r.nombre).join(', '))
    process.exit(1)
  }
  console.log('✓ Todos los asesorados están completos.')
}

main().catch((e) => { console.error(e); process.exit(1) })
