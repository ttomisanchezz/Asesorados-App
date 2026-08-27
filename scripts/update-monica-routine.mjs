// =============================================================================
// update-monica-routine.mjs  —  Renombra los días de la rutina de Mónica y
// reemplaza los ejercicios del Día 4 (Torso).
//
// CAMBIO PEDIDO:
//   Día 1 → Pierna — enfoque cuádriceps   (solo el nombre; ejercicios TAL CUAL)
//   Día 2 → Espalda                       (solo el nombre; ejercicios TAL CUAL)
//   Día 3 → Pierna — enfoque glúteo       (solo el nombre; ejercicios TAL CUAL)
//   Día 4 → Torso                         (nombre + ejercicios NUEVOS, ver abajo)
//   Día 5 → Pierna — enfoque cuádriceps   (solo el nombre; ejercicios TAL CUAL)
//
// REGLAS (mismas que import-clients.mjs / add-ro-glute-day.mjs):
//   - DRY-RUN por defecto. Solo escribe con --apply.
//   - service_role SOLO desde env SUPABASE_SERVICE_ROLE_KEY (nunca de archivos).
//   - Edita la versión activa EN EL LUGAR (igual que updateWorkoutPlanVersion en
//     la app): no crea versión nueva ni toca el historial.
//   - NO inventa: si Mónica no tiene rutina activa, o su rutina no tiene 5 días,
//     se DETIENE. Renombrar un "Día 5" que no existe sería fabricar rutina.
//   - Idempotente: si ya está en el estado final, no reescribe nada.
//   - De los días 1/2/3/5 solo toca 'focus'. Sus ejercicios no se pisan.
//
// USO (PowerShell):
//   $env:SUPABASE_SERVICE_ROLE_KEY="..."; $env:SUPABASE_URL="https://<ref>.supabase.co"
//   node scripts/update-monica-routine.mjs            # dry-run: muestra el antes/después
//   node scripts/update-monica-routine.mjs --apply    # escribe en la DB
//
// SALIDA: exit 0 si OK; exit 1 si no se pudo aplicar.
// =============================================================================

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const APPLY = process.argv.includes('--apply')

// ── Foco de cada día, por índice (0..4).
const FOCUS_BY_DAY = [
  'Pierna — enfoque cuádriceps',
  'Espalda',
  'Pierna — enfoque glúteo',
  'Torso',
  'Pierna — enfoque cuádriceps',
]

// ── Día 4: ejercicios NUEVOS (reemplazan por completo a los actuales).
//    reps/sets/rir como string, igual que el resto de la rutina (ver
//    buildExercise en import-clients.mjs). RIR 0 en todos, indicado por el coach.
const DAY4_INDEX = 3
const DAY4_EXERCISES = [
  { name: 'Jalón al pecho',               sets: '3', rir: '0', reps: '6-10', notes: null, videoUrl: null },
  { name: 'Curl de bíceps en polea baja', sets: '3', rir: '0', reps: '6-10', notes: null, videoUrl: null },
  { name: 'Remo sentado',                 sets: '3', rir: '0', reps: '6-10', notes: null, videoUrl: null },
  { name: 'Elevaciones laterales',        sets: '3', rir: '0', reps: '6-10', notes: null, videoUrl: null },
  { name: 'Peck deck',                    sets: '3', rir: '0', reps: '6-10', notes: null, videoUrl: null },
]

function readEnvLocal(name) {
  for (const file of ['.env.local', '.env']) {
    try {
      const env = fs.readFileSync(path.join(ROOT, file), 'utf8')
      const m = env.match(new RegExp('^' + name + '=(.*)$', 'm'))
      if (m) return m[1].trim()
    } catch { /* probamos el próximo archivo */ }
  }
  return null
}
function exit(msg) { console.error('\n✗ ' + msg + '\n'); process.exit(1) }
const shortId = (id) => String(id).slice(0, 8)
const labelOf = (d) => d?.focus || d?.day || '(sin foco)'

async function resolveMonica(sb) {
  for (const slug of ['monica', 'mónica']) {
    const { data } = await sb.from('clients').select('id, slug, full_name').eq('slug', slug).maybeSingle()
    if (data) return data
  }
  const { data: byName } = await sb.from('clients')
    .select('id, slug, full_name')
    .or('full_name.ilike.%monica%,full_name.ilike.%mónica%')
  if (byName?.length === 1) return byName[0]
  if (byName?.length > 1) exit('Más de un cliente coincide con "Mónica": ' +
    byName.map((c) => `${c.slug} (${c.full_name})`).join(', ') + '. Desambiguá antes de aplicar.')
  return null
}

// Compara los ejercicios actuales del día 4 contra el objetivo (idempotencia).
function sameDay4(current) {
  const cur = current ?? []
  if (cur.length !== DAY4_EXERCISES.length) return false
  return DAY4_EXERCISES.every((want, i) => {
    const got = cur[i] ?? {}
    return String(got.name ?? '').trim().toLowerCase() === want.name.toLowerCase() &&
           String(got.sets ?? '') === want.sets &&
           String(got.reps ?? '') === want.reps &&
           String(got.rir ?? '') === want.rir
  })
}

async function main() {
  const url = process.env.SUPABASE_URL || readEnvLocal('VITE_SUPABASE_URL')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const missing = []
  if (!key) missing.push('SUPABASE_SERVICE_ROLE_KEY  (del entorno; nunca de archivos)')
  if (!url) missing.push('SUPABASE_URL  (o VITE_SUPABASE_URL en .env.local)')
  if (missing.length) exit('Faltan variables de entorno:\n   - ' + missing.join('\n   - ') +
    '\n\n   PowerShell:\n     $env:SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"\n     $env:SUPABASE_URL="https://<ref>.supabase.co"')

  const sb = createClient(url, key, { auth: { persistSession: false } })

  console.log('\n=== Rutina de Mónica: renombrar días + reemplazar Día 4  [' + (APPLY ? 'APPLY' : 'DRY-RUN') + '] ===')

  const client = await resolveMonica(sb)
  if (!client) exit('No encontré a Mónica en clients (probé slug monica/mónica y full_name).\n' +
    '   Revisá el slug real en la DB y pasámelo, o cargá primero su ficha.')
  console.log(`Cliente: ${client.full_name}  (slug=${client.slug}, id=${shortId(client.id)}…)`)

  const { data: plan, error } = await sb.from('workout_plans')
    .select('id, title, days, active')
    .eq('client_id', client.id).eq('active', true)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (error) exit('Error leyendo workout_plans: ' + error.message)
  if (!plan) exit('Mónica NO tiene una rutina activa en la DB. No invento la rutina base:\n' +
    '   cargá sus días primero (o decime que querés crear el plan desde cero).')

  const days = Array.isArray(plan.days) ? plan.days : []
  console.log(`\nRutina activa: "${plan.title ?? '(sin título)'}"  · ${days.length} día(s) actuales:`)
  days.forEach((d, i) => console.log(`   ${i + 1}. ${labelOf(d)} — ${(d.exercises ?? []).length} ejercicios`))

  if (days.length !== FOCUS_BY_DAY.length) exit(
    `Su rutina activa tiene ${days.length} día(s) y el cambio pedido describe ${FOCUS_BY_DAY.length}.\n` +
    '   No agrego ni borro días por mi cuenta. Decime qué hacer con la diferencia y lo ajusto.')

  // ── Nuevo array de días: solo cambia 'focus' salvo en el Día 4.
  const nextDays = days.map((d, i) => {
    const base = { ...d, day: d.day || `Día ${i + 1}`, focus: FOCUS_BY_DAY[i] }
    return i === DAY4_INDEX ? { ...base, exercises: DAY4_EXERCISES } : base
  })
  const title = `Rutina ${nextDays.length} días — ${nextDays.map((d) => d.focus).join(' / ')}`.slice(0, 180)

  console.log('\n── Cambios ─────────────────────────────────────────────')
  days.forEach((d, i) => {
    const from = labelOf(d), to = FOCUS_BY_DAY[i]
    const nameChange = from !== to ? `"${from}" → "${to}"` : `"${to}" (nombre sin cambios)`
    console.log(`   Día ${i + 1}: ${nameChange}` + (i === DAY4_INDEX ? '  · EJERCICIOS REEMPLAZADOS' : '  · ejercicios TAL CUAL'))
  })

  console.log(`\n   Día 4 · Torso — ejercicios nuevos (${DAY4_EXERCISES.length}):`)
  DAY4_EXERCISES.forEach((e, i) => console.log(`      ${i + 1}. ${e.name} — ${e.sets} series x ${e.reps} reps · RIR ${e.rir}`))

  const old4 = days[DAY4_INDEX]?.exercises ?? []
  if (old4.length) {
    console.log(`\n   Día 4 — ejercicios que se PIERDEN (${old4.length}):`)
    old4.forEach((e, i) => console.log(`      ${i + 1}. ${e.name ?? '(sin nombre)'} — ${e.sets ?? '?'} series x ${e.reps ?? '?'} reps`))
  }

  console.log(`\n   Título nuevo: "${title}"`)
  console.log('   Nota: los 5 ejercicios del Día 4 van con RIR 0.')

  const alreadyDone = days.every((d, i) => labelOf(d) === FOCUS_BY_DAY[i]) &&
                      sameDay4(days[DAY4_INDEX]?.exercises) &&
                      plan.title === title
  if (alreadyDone) {
    console.log('\n✓ La rutina ya está en el estado pedido — no se reescribe nada.\n')
    return
  }

  if (!APPLY) {
    console.log('\n✓ DRY-RUN OK: no se escribió nada. Reejecutá con --apply para aplicar.\n')
    return
  }

  const { error: upErr } = await sb.from('workout_plans')
    .update({ days: nextDays, title }).eq('id', plan.id)
  if (upErr) exit('Error al actualizar workout_plans: ' + upErr.message)
  console.log(`\n✓ APPLY OK — rutina de ${client.full_name} actualizada (${nextDays.length} días).\n`)
}

main().catch((e) => exit(e.message))
