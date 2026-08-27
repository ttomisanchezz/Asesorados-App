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
//   node scripts/update-monica-routine.mjs --list           # READ-ONLY: lista los clientes
//   node scripts/update-monica-routine.mjs --show           # READ-ONLY: vuelca su rutina completa
//   node scripts/update-monica-routine.mjs                  # dry-run: muestra el antes/después
//   node scripts/update-monica-routine.mjs --slug=<slug>    # si no figura como "monica"
//   node scripts/update-monica-routine.mjs --apply          # escribe en la DB
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
const LIST = process.argv.includes('--list')
const SHOW = process.argv.includes('--show')
// --slug=<slug> apunta a un cliente puntual (si no figura como "monica").
const TARGET_SLUG = (process.argv.find((a) => a.startsWith('--slug=')) ?? '').split('=').slice(1).join('=').trim() || null

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

// ── Reubicación de los bloques de pierna.
//    El contenido NO se transcribe acá: se lee de la base y se mueve entero.
//    Estas firmas identifican cada bloque por un ejercicio que solo aparece en él.
const QUAD_SIGNATURE = 'sillon cuadricep'  // bloque de cuádriceps → Días 1 y 5
const GLUTE_SIGNATURE = 'hip trust'        // bloque de glúteo     → Día 3

// ── Día 2: se le suma este ejercicio. "Curl bíceps sentada" YA lo tiene, así
//    que solo falta el martillo; se copian series/reps/RIR del que ya está.
const DAY2_NEW_EXERCISE = { name: 'Curl bíceps martillo', sets: '3', rir: '0', reps: '6-10', notes: null, videoUrl: null }
//    IMPORTANTE: los nombres van EXACTAMENTE como ya figuran en su rutina.
//    workout_exercise_logs.exercise_name es texto libre y el "último peso" se
//    busca por ese string (ver workoutLogService), así que renombrar un
//    ejercicio le borra el historial de cargas. Solo "Jalón al pecho" es nuevo.
const DAY4_EXERCISES = [
  { name: 'Jalón al pecho',                 sets: '3', rir: '0', reps: '6-10', notes: null, videoUrl: null }, // nuevo
  { name: 'Curl bíceps en polea de abajo',  sets: '3', rir: '0', reps: '6-10', notes: null, videoUrl: null }, // ya existía
  { name: 'Remo sentada',                   sets: '3', rir: '0', reps: '6-10', notes: null, videoUrl: null }, // ya existía
  { name: 'Elevaciones laterales',          sets: '3', rir: '0', reps: '6-10', notes: null, videoUrl: null }, // ya existía
  { name: 'Peck deck',                      sets: '3', rir: '0', reps: '6-10', notes: null, videoUrl: null }, // ya existía
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
// Aborta sin process.exit(): cortar de golpe con handles async abiertos dispara
// "Assertion failed ... uv_async" en Windows. Se propaga al catch de main().
class Abort extends Error {}
function exit(msg) { throw new Abort(msg) }

// Identifica el TIPO de key sin imprimirla nunca. Este proyecto usa el formato
// nuevo de Supabase (ver .env.example: sb_publishable_…), cuya contraparte
// secreta es sb_secret_…, no el JWT legacy de service_role.
function keyKind(key) {
  if (key.startsWith('sb_secret_')) return { ok: true, label: 'secret key (sb_secret_…)' }
  if (key.startsWith('sb_publishable_')) return { ok: false, label: 'la key PUBLICABLE (sb_publishable_…), que es la pública' }
  if (key.startsWith('eyJ')) {
    try {
      const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64').toString('utf8'))
      const role = String(payload.role ?? '(sin role)')
      return { ok: role === 'service_role', label: `un JWT legacy con role="${role}"` }
    } catch { return { ok: false, label: 'un JWT ilegible' } }
  }
  return { ok: false, label: 'de formato desconocido' }
}
const shortId = (id) => String(id).slice(0, 8)
const labelOf = (d) => d?.focus || d?.day || '(sin foco)'
const norm = (s) => String(s ?? '').trim().toLowerCase()
const clone = (v) => structuredClone(v)
// Ubica el día que contiene un ejercicio dado. Si hay varios (pasa después de
// aplicar, con el bloque de cuádriceps duplicado en 1 y 5), devuelve el primero:
// son idénticos, así que el resultado no cambia y la operación es idempotente.
const findDayWith = (days, signature) =>
  days.find((d) => (d.exercises ?? []).some((e) => norm(e.name).includes(signature)))

// READ-ONLY: lista los clientes con su slug y los días de su rutina activa,
// para identificar a mano bajo qué nombre está cargada Mónica.
async function listClients(sb) {
  const { data: clients, error } = await sb.from('clients')
    .select('id, slug, full_name, status').order('slug')
  if (error) exit('Error leyendo clients: ' + error.message)
  if (!clients?.length) { console.log('\n(No hay clientes cargados.)\n'); return }

  const { data: plans, error: pErr } = await sb.from('workout_plans')
    .select('client_id, days').eq('active', true)
  if (pErr) exit('Error leyendo workout_plans: ' + pErr.message)
  const daysByClient = new Map((plans ?? []).map((p) => [p.client_id, (Array.isArray(p.days) ? p.days : []).length]))

  console.log(`\n${clients.length} cliente(s):\n`)
  const pad = Math.max(...clients.map((c) => (c.slug ?? '').length), 4)
  console.log('   ' + 'slug'.padEnd(pad) + '  nombre'.padEnd(34) + '  rutina activa')
  console.log('   ' + '─'.repeat(pad) + '  ' + '─'.repeat(32) + '  ' + '─'.repeat(14))
  for (const c of clients) {
    const n = daysByClient.get(c.id)
    const plan = n == null ? 'sin rutina activa' : `${n} día(s)`
    console.log('   ' + String(c.slug ?? '—').padEnd(pad) + '  ' + String(c.full_name ?? '—').padEnd(32).slice(0, 32) + '  ' + plan)
  }
  console.log('\nUsá el slug de Mónica así:\n   node scripts/update-monica-routine.mjs --slug=<slug>\n')
}

async function resolveMonica(sb) {
  if (TARGET_SLUG) {
    const { data, error } = await sb.from('clients')
      .select('id, slug, full_name').eq('slug', TARGET_SLUG).maybeSingle()
    if (error) exit(`Error buscando el slug "${TARGET_SLUG}": ` + error.message)
    if (!data) exit(`No existe ningún cliente con slug "${TARGET_SLUG}".\n` +
      '   Corré --list para ver los slugs reales.')
    return data
  }

  for (const slug of ['monica', 'mónica']) {
    const { data, error } = await sb.from('clients')
      .select('id, slug, full_name').eq('slug', slug).maybeSingle()
    if (error) exit('Error buscando por slug: ' + error.message)
    if (data) return data
  }

  // Una consulta por variante: un .or() con acentos puede fallar y, si no se
  // mira el error, un fallo se confunde con "no existe".
  const found = new Map()
  for (const term of ['%monica%', '%mónica%', '%moni%']) {
    const { data, error } = await sb.from('clients')
      .select('id, slug, full_name').ilike('full_name', term)
    if (error) exit(`Error buscando por nombre ("${term}"): ` + error.message)
    for (const c of data ?? []) found.set(c.id, c)
  }
  const hits = [...found.values()]
  if (hits.length === 1) return hits[0]
  if (hits.length > 1) exit('Más de un cliente coincide con "Mónica": ' +
    hits.map((c) => `${c.slug} (${c.full_name})`).join(', ') +
    '.\n   Reejecutá con --slug=<el correcto>.')
  return null
}

// ── Transformación pura: recibe los días actuales y devuelve los nuevos.
//    Los bloques de pierna se ubican por CONTENIDO, no por posición: se leen de
//    la base tal como están (series, RIR y notas incluidas) y se reubican
//    enteros. Así no se transcriben a mano y la operación es idempotente:
//    después de aplicar, las firmas siguen resolviendo al mismo bloque.
//    Exportada para poder probarla sin tocar la DB.
export function buildPlan(days) {
  const quadDay = findDayWith(days, QUAD_SIGNATURE)
  const gluteDay = findDayWith(days, GLUTE_SIGNATURE)
  if (!quadDay) exit(`No encontré el bloque de cuádriceps: ningún día tiene "${QUAD_SIGNATURE}".\n` +
    '   Corré --show y decime en qué día quedó; sin eso no reubico nada a ciegas.')
  if (!gluteDay) exit(`No encontré el bloque de glúteo: ningún día tiene "${GLUTE_SIGNATURE}".\n` +
    '   Corré --show y decime en qué día quedó; sin eso no reubico nada a ciegas.')

  const quadExercises = clone(quadDay.exercises ?? [])
  const gluteExercises = clone(gluteDay.exercises ?? [])

  // Día 2: se conserva entero y se le suma el curl martillo si todavía no está.
  const day2Exercises = clone(days[1]?.exercises ?? [])
  if (!day2Exercises.some((e) => norm(e.name).includes('martillo'))) day2Exercises.push(clone(DAY2_NEW_EXERCISE))

  const exercisesFor = (i) => {
    if (i === 0) return quadExercises
    if (i === 1) return day2Exercises
    if (i === 2) return gluteExercises
    if (i === DAY4_INDEX) return clone(DAY4_EXERCISES)
    return clone(quadExercises) // Día 5: copia del Día 1
  }
  const nextDays = days.map((d, i) => ({
    ...d, day: d.day || `Día ${i + 1}`, focus: FOCUS_BY_DAY[i], exercises: exercisesFor(i),
  }))
  const title = `Rutina ${nextDays.length} días — ${nextDays.map((d) => d.focus).join(' / ')}`.slice(0, 180)
  return { nextDays, title }
}

async function main() {
  const url = process.env.SUPABASE_URL || readEnvLocal('VITE_SUPABASE_URL')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const missing = []
  if (!key) missing.push('SUPABASE_SERVICE_ROLE_KEY  (del entorno; nunca de archivos)')
  if (!url) missing.push('SUPABASE_URL  (o VITE_SUPABASE_URL en .env.local)')
  if (missing.length) exit('Faltan variables de entorno:\n   - ' + missing.join('\n   - ') +
    '\n\n   PowerShell:\n     $env:SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"\n     $env:SUPABASE_URL="https://<ref>.supabase.co"')

  const kind = keyKind(key)
  if (!kind.ok) {
    console.warn('\n⚠ La key que pasaste parece ser ' + kind.label + '.' +
      '\n   Hace falta la SECRETA del proyecto: Supabase → Project Settings → API Keys → secret (sb_secret_…).' +
      '\n   Sigo igual por si me equivoco, pero si ves "Invalid API key" es por esto.')
  }

  const sb = createClient(url, key, { auth: { persistSession: false } })

  if (LIST) { await listClients(sb); return }

  console.log('\n=== Rutina de Mónica: renombrar días + reemplazar Día 4  [' + (APPLY ? 'APPLY' : 'DRY-RUN') + '] ===')

  const client = await resolveMonica(sb)
  if (!client) exit('No encontré a Mónica en clients (probé slug monica/mónica y full_name).\n' +
    '   Corré esto para ver bajo qué nombre está cargada:\n' +
    '     node scripts/update-monica-routine.mjs --list\n' +
    '   y después reejecutá con --slug=<el suyo>.')
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

  // --show: vuelca la rutina completa y corta. READ-ONLY, no evalúa cambios.
  if (SHOW) {
    console.log('\n── Rutina actual, día por día ──────────────────────────')
    days.forEach((d, i) => {
      console.log(`\n   DÍA ${i + 1} · ${labelOf(d)}`)
      const exs = d.exercises ?? []
      if (!exs.length) { console.log('      (sin ejercicios)'); return }
      exs.forEach((e, j) => {
        const bits = [`${e.sets ?? '?'} series`, `${e.reps ?? '?'} reps`]
        if (e.rir != null && e.rir !== '') bits.push(`RIR ${e.rir}`)
        if (e.notes) bits.push(String(e.notes))
        console.log(`      ${j + 1}. ${e.name ?? '(sin nombre)'} — ${bits.join(' · ')}`)
      })
    })
    console.log('\n✓ Solo lectura: no se evaluó ni escribió ningún cambio.\n')
    return
  }

  if (days.length !== FOCUS_BY_DAY.length) exit(
    `Su rutina activa tiene ${days.length} día(s) y el cambio pedido describe ${FOCUS_BY_DAY.length}.\n` +
    '   No agrego ni borro días por mi cuenta. Decime qué hacer con la diferencia y lo ajusto.')

  const { nextDays, title } = buildPlan(days)

  console.log('\n── Cambios ─────────────────────────────────────────────')
  nextDays.forEach((next, i) => {
    const before = days[i], from = labelOf(before), to = next.focus
    console.log(`\n   DÍA ${i + 1}: ${from !== to ? `"${from}" → "${to}"` : `"${to}" (nombre sin cambios)`}`)
    const beforeNames = (before.exercises ?? []).map((e) => norm(e.name))
    const afterNames = next.exercises.map((e) => norm(e.name))
    if (JSON.stringify(before.exercises ?? []) === JSON.stringify(next.exercises)) {
      console.log('      ejercicios: sin cambios')
      return
    }
    next.exercises.forEach((e, j) => {
      const tag = beforeNames.includes(norm(e.name)) ? '' : '   ← NUEVO acá'
      console.log(`      ${j + 1}. ${e.name} — ${e.sets ?? '?'} series x ${e.reps ?? '?'} reps` +
        (e.rir != null && e.rir !== '' ? ` · RIR ${e.rir}` : '') + tag)
    })
    const dropped = (before.exercises ?? []).filter((e) => !afterNames.includes(norm(e.name)))
    if (dropped.length) {
      console.log(`      SE PIERDEN de este día (${dropped.length}):`)
      dropped.forEach((e) => console.log(`         · ${e.name ?? '(sin nombre)'} — ${e.sets ?? '?'} series x ${e.reps ?? '?'} reps`))
    }
  })

  console.log(`\n   Título nuevo: "${title}"`)

  // Aviso: un ejercicio que desaparece de TODA la rutina pierde su historial de
  // cargas (workout_exercise_logs se vincula por nombre, no por id).
  const beforeAll = new Set(days.flatMap((d) => (d.exercises ?? []).map((e) => norm(e.name))))
  const afterAll = new Set(nextDays.flatMap((d) => d.exercises.map((e) => norm(e.name))))
  const goneForGood = [...beforeAll].filter((n) => !afterAll.has(n))
  if (goneForGood.length) {
    console.log(`\n   ⚠ Salen de la rutina por completo (${goneForGood.length}) y dejan de mostrar historial:`)
    goneForGood.forEach((n) => console.log(`      · ${n}`))
  }

  if (JSON.stringify(nextDays) === JSON.stringify(days) && plan.title === title) {
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

// Solo corre si se ejecuta directo; importarlo (para testear buildPlan) no dispara nada.
const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) main().catch((e) => {
  console.error('\n✗ ' + e.message + '\n')
  if (/invalid api key/i.test(e.message)) {
    console.error('   "Invalid API key" = Supabase rechazó la credencial. Chequeá, en orden:\n' +
      '   1. Que sea la key SECRETA (sb_secret_…), no la publicable ni la anon.\n' +
      '      Supabase → Project Settings → API Keys → secret.\n' +
      '   2. Que sea del MISMO proyecto que SUPABASE_URL.\n' +
      '   3. En PowerShell, comillas dobles y sin espacios ni saltos de línea:\n' +
      '        $env:SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."\n' +
      '      Verificá que quedó entera (sin imprimirla):\n' +
      '        $env:SUPABASE_SERVICE_ROLE_KEY.Length\n')
  }
  process.exitCode = 1
})
