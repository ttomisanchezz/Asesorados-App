// =============================================================================
// add-ro-glute-day.mjs  —  Suma un día de GLÚTEO a la rutina activa de Rocío.
//
// CONTEXTO:
//   Rocío empieza a ir 3 días al gym. Se mantiene su rutina actual TAL CUAL y
//   se agrega un día más (enfocado en glúteo) al final. No hay editor de rutinas
//   en la UI, así que el cambio se aplica acá, directo sobre workout_plans.days.
//
// REGLAS (mismas que import-clients.mjs):
//   - DRY-RUN por defecto. Solo escribe con --apply.
//   - service_role SOLO desde env SUPABASE_SERVICE_ROLE_KEY (nunca de archivos).
//   - LEE la rutina viva y APENDEA: nunca pisa los días existentes.
//   - Idempotente: si el día de glúteo ya está, no lo duplica.
//   - NO inventa: si Rocío no tiene rutina activa, se DETIENE. Un "día 3" implica
//     2 días previos que deben existir en la DB; si no están, hay que cargarlos
//     primero (este script no fabrica la rutina base).
//
// USO (PowerShell):
//   $env:SUPABASE_SERVICE_ROLE_KEY="..."; $env:SUPABASE_URL="https://<ref>.supabase.co"
//   node scripts/add-ro-glute-day.mjs            # dry-run: muestra qué haría
//   node scripts/add-ro-glute-day.mjs --apply     # escribe en la DB
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

// ── El día nuevo. RIR 0 en todos. reps como string ("6-10" o "10"), igual que
//    el resto de la rutina (ver buildExercise en import-clients.mjs).
const FOCUS = 'Glúteo'
const NEW_EXERCISES = [
  { name: 'Hip Thrust',                                        sets: '3', rir: '0', reps: '6-10',  notes: null, videoUrl: null },
  { name: 'Peso muerto con mancuernas unilateral con apoyo',   sets: '2', rir: '0', reps: '8-10',  notes: null, videoUrl: null },
  { name: 'Abducción en máquina',                              sets: '3', rir: '0', reps: '8-12',  notes: null, videoUrl: null },
  { name: 'Hiperextensiones lumbares / patada de glúteo',      sets: '2', rir: '0', reps: '10',    notes: null, videoUrl: null },
  { name: 'Sillón de cuádriceps',                              sets: '3', rir: '0', reps: '10',    notes: null, videoUrl: null },
]

function readEnvLocal(name) {
  try {
    const env = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
    const m = env.match(new RegExp('^' + name + '=(.*)$', 'm'))
    return m ? m[1].trim() : null
  } catch { return null }
}
function exit(msg) { console.error('\n✗ ' + msg + '\n'); process.exit(1) }
const shortId = (id) => String(id).slice(0, 8)

// Identifica el día de glúteo ya existente (por focus o por su ejercicio firma).
function hasGluteDay(days) {
  return days.some((d) => {
    const focus = String(d.focus ?? '').toLowerCase()
    if (focus.includes('glúteo') || focus.includes('gluteo')) return true
    return (d.exercises ?? []).some((e) => /hip thrust/i.test(String(e.name ?? '')))
  })
}

async function resolveRocio(sb) {
  // En la DB su slug es 'rocio' (el registro de import-clients la tiene como 'ro').
  // Probamos ambos y, si no, por nombre. Si hay ambigüedad, frenamos.
  for (const slug of ['rocio', 'ro']) {
    const { data } = await sb.from('clients').select('id, slug, full_name').eq('slug', slug).maybeSingle()
    if (data) return data
  }
  const { data: byName } = await sb.from('clients')
    .select('id, slug, full_name')
    .or('full_name.ilike.%adra%,full_name.ilike.%rocío%,full_name.ilike.%rocio%')
  if (byName?.length === 1) return byName[0]
  if (byName?.length > 1) exit('Más de un cliente coincide con "Rocío/Adra": ' +
    byName.map((c) => `${c.slug} (${c.full_name})`).join(', ') + '. Desambiguá antes de aplicar.')
  return null
}

async function main() {
  const url = process.env.SUPABASE_URL || readEnvLocal('VITE_SUPABASE_URL')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const missing = []
  if (!key) missing.push('SUPABASE_SERVICE_ROLE_KEY  (del entorno; nunca de archivos)')
  if (!url) missing.push('SUPABASE_URL  (o VITE_SUPABASE_URL en .env.local)')
  if (missing.length) exit('Faltan variables de entorno:\n   - ' + missing.join('\n   - ') +
    "\n\n   PowerShell:\n     $env:SUPABASE_SERVICE_ROLE_KEY='<service-role-key>'\n     $env:SUPABASE_URL='https://<ref>.supabase.co'")

  const sb = createClient(url, key, { auth: { persistSession: false } })

  console.log(`\n=== Agregar día de ${FOCUS} a Rocío  [${APPLY ? 'APPLY' : 'DRY-RUN'}] ===`)

  const client = await resolveRocio(sb)
  if (!client) exit('No encontré a Rocío en clients (probé slug rocio/ro y nombre). Revisá el slug real en la DB.')
  console.log(`Cliente: ${client.full_name}  (slug=${client.slug}, id=${shortId(client.id)}…)`)

  const { data: plan, error } = await sb.from('workout_plans')
    .select('id, title, days, active')
    .eq('client_id', client.id).eq('active', true)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (error) exit('Error leyendo workout_plans: ' + error.message)

  if (!plan) exit(
    'Rocío NO tiene una rutina activa en la DB.\n' +
    '   Un "día 3" implica 2 días previos que deberían existir y NO están.\n' +
    '   No invento la rutina base: cargá sus 2 días actuales primero (o decime que querés\n' +
    '   crear un plan nuevo con SOLO este día de glúteo) y volvé a correr esto.')

  const days = Array.isArray(plan.days) ? plan.days : []
  console.log(`Rutina activa: "${plan.title ?? '(sin título)'}"  · ${days.length} día(s) actuales:`)
  days.forEach((d, i) => console.log(`   ${i + 1}. ${d.focus ?? d.day ?? '(s/foco)'} — ${(d.exercises ?? []).length} ejercicios`))

  if (hasGluteDay(days)) {
    console.log('\n✓ Ya existe un día de glúteo en la rutina — no se duplica. Nada que hacer.')
    return
  }

  const newDay = { day: `Día ${days.length + 1}`, focus: FOCUS, exercises: NEW_EXERCISES }
  const nextDays = [...days, newDay]
  const title = `Rutina ${nextDays.length} días — ${nextDays.map((d) => d.focus).join(' / ')}`.slice(0, 180)

  console.log(`\nSe AGREGA → ${newDay.day} · ${FOCUS}  (${NEW_EXERCISES.length} ejercicios, todos RIR 0):`)
  NEW_EXERCISES.forEach((e, i) => console.log(`   ${i + 1}. ${e.name} — ${e.sets} series x ${e.reps} reps`))
  console.log(`Título nuevo: "${title}"`)
  console.log(`Días existentes: SE MANTIENEN TAL CUAL (1..${days.length}).`)

  if (!APPLY) {
    console.log('\n✓ DRY-RUN OK: no se escribió nada. Reejecutá con --apply para aplicar.\n')
    return
  }

  const { error: upErr } = await sb.from('workout_plans')
    .update({ days: nextDays, title }).eq('id', plan.id)
  if (upErr) exit('Error al actualizar workout_plans: ' + upErr.message)
  console.log(`\n✓ APPLY OK — rutina de ${client.full_name} ahora tiene ${nextDays.length} días.\n`)
}

main().catch((e) => exit(e.message))
