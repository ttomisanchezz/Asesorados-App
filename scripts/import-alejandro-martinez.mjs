// =============================================================================
// import-alejandro-martinez.mjs  —  Alta quirúrgica de UN asesorado: Alejandro Martínez.
//
// Carga SOLO a Alejandro (perfil + nutrición 2300 kcal con 2 esquemas + rutina de
// 5 días). No toca a ningún otro asesorado, ni el panel, ni el login de terceros.
//
// SEGURIDAD / REGLAS (mismas que import-clients.mjs y add-ro-glute-day.mjs):
//   - DRY-RUN por defecto. Solo escribe con --apply.
//   - service_role key SOLO desde env SUPABASE_SERVICE_ROLE_KEY (nunca de archivos).
//   - Idempotente: client por slug 'alejandro-martinez'; nutrición/rutina por "plan activo".
//     Re-correr no duplica: actualiza el plan activo existente.
//   - NO inventa datos: lo que el brief no trae queda null/omitido.
//   - NO crea login salvo que se envíen credenciales explícitas por env (ver ABAJO).
//   - NUNCA imprime la service_role key ni la contraseña.
//
// USO (PowerShell):
//   $env:SUPABASE_SERVICE_ROLE_KEY="..."; node scripts/import-alejandro-martinez.mjs            # dry-run
//   $env:SUPABASE_SERVICE_ROLE_KEY="..."; node scripts/import-alejandro-martinez.mjs --apply     # escribe
//   $env:SUPABASE_SERVICE_ROLE_KEY="..."; node scripts/import-alejandro-martinez.mjs --verify     # solo lectura
//
// COACH (clients.coach_id → public.profiles.id):
//   Por defecto resuelve el único profile con role='coach'. Si hubiera más de uno:
//   $env:COACH_EMAIL="coach@dominio.com"   o   $env:COACH_ID="<uuid de public.profiles>"
//
// LOGIN DEL ASESORADO (OPCIONAL — solo si te pasaron credenciales):
//   $env:ALEJANDRO_LOGIN_EMAIL="alejandro@dominio.com"
//   $env:ALEJANDRO_LOGIN_PASSWORD="<contraseña>"
//   Con ambas + --apply: crea/vincula el usuario de auth y el profile rol 'client'.
//   Sin ellas: NO se crea login (se reporta como pendiente). No se inventa nada.
//
// SALIDA: exit 0 si OK; exit 1 si falla cualquier escritura en --apply.
// =============================================================================

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const APPLY = process.argv.includes('--apply')
const VERIFY = process.argv.includes('--verify')

// ── Datos del asesorado (del brief) ──────────────────────────────────────────
const SLUG = 'alejandro-martinez'
const FULL_NAME = 'Alejandro Martínez'

const PROFILE = {
  age: 21,
  weight: 85,        // kg
  height: 181,       // 1,81 m → cm (mismo criterio que el resto: Tomi 188, Mateo 180)
  objective: 'Rendimiento y adherencia (carbohidrato alto)',
  // Pasos y frecuencia de fuerza no tienen columna propia → van al "Objetivo
  // semanal" (weekly_goal), que el panel del coach muestra en el resumen.
  weekly_goal: '10.000 pasos/día · Fuerza 4-5 días/semana',
}

// ── Nutrición: 2300 kcal, macros objetivo + 2 esquemas según horario de entreno ──
const NUTRITION = {
  calories: 2300,
  protein: 85,   // objetivo; por los alimentos puede quedar 90-100 g (aceptable)
  carbs: 394,
  fats: 42,      // brief: 42-43 g (la columna es entera → 42; rango aclarado en notas)
  notes: [
    'Plan de 2300 kcal. Enfoque: carbohidrato alto alrededor del entrenamiento para sostener intensidad, rendimiento y adherencia.',
    'Proteína objetivo ~85 g; por los alimentos usados puede quedar en 90-100 g (aceptable). Grasas ~42-43 g. Carbohidratos ~394 g.',
    'Aclaraciones:',
    '• Arroz y fideos: pesados en crudo/seco.',
    '• Avena: pesada en seco.',
    '• Papa: mantener siempre el mismo criterio de pesado.',
    '• Zapallito: libre, no hace falta contarlo de forma estricta.',
  ].join('\n'),
}

// Opciones reutilizadas en ambos esquemas.
const OPT_ALMUERZO = [
  { title: 'Opción arroz', items: ['Arroz: 160 g en crudo', 'Huevos: 2 unidades', 'Zapallito: libre / al fallo'] },
  { title: 'Opción fideos', items: ['Fideos: 170 g en seco', 'Huevos: 2 unidades', 'Zapallito: libre / al fallo'] },
]
const OPT_POST_ENTRENO = [
  { title: 'Opción A', items: ['Galletas de arroz: 60 g', 'Manzana: 200 g'] },
  { title: 'Opción B', items: ['Galletas de arroz: 60 g', 'Banana: 100 g'] },
  { title: 'Opción C', items: ['Pan: 140 g'] },
  { title: 'Opción D', items: ['Avena: 80 g', 'Leche descremada: 200 ml', 'Cacao: 20 g'] },
]
const OPT_CARBO_ALTO = [ // desayuno (esq.1) / pre-entreno (esq.2): mismas alternativas
  { title: 'Opción A', items: ['Galletas de arroz: 70 g', 'Banana: 120 g'] },
  { title: 'Opción B', items: ['Pan: 160 g'] },
  { title: 'Opción C', items: ['Avena: 90 g', 'Leche descremada: 200 ml', 'Cacao: 20 g'] },
]
const MEAL_CENA = {
  name: 'Cena',
  options: [
    { title: 'Opción única', items: ['Papa: 500 g', 'Carne magra: 150 g', 'Huevo: 1 unidad', 'Zapallito: libre / al fallo', 'Aceite de oliva: 10 g'] },
  ],
}

const MEALS = [
  {
    scheme: 'Si entrenás a las 14:00',
    description: '',
    meals: [
      { name: 'Desayuno', options: OPT_CARBO_ALTO },
      { name: 'Almuerzo / Pre-entreno', options: OPT_ALMUERZO },
      { name: 'Post-entreno', options: OPT_POST_ENTRENO },
      MEAL_CENA,
    ],
  },
  {
    scheme: 'Si entrenás a las 18:00 o más tarde',
    description: '',
    meals: [
      { name: 'Almuerzo', options: OPT_ALMUERZO },
      { name: 'Pre-entreno (hacer esta comida mínimo 1 hora antes de entrenar)', options: OPT_CARBO_ALTO },
      { name: 'Post-entreno', options: OPT_POST_ENTRENO },
      MEAL_CENA,
    ],
  },
]

// ── Rutina: 5 días, transcrita de las imágenes ───────────────────────────────
// reps como string ("6-10", "12-15", "8-10") igual que el resto de la app.
// rir '0' en toda la planilla. videoUrl null (la planilla no trae URLs).
// NOTA: "Prensa" (Día 2) y "Hip thrust máquina" (Día 5) traían en la planilla un
//    valor de reps ilegible ("19-1"). El coach confirmó: Prensa 10-15, Hip 8-10.
const ex = (name, sets, reps, notes = null) => ({ name, sets, rir: '0', reps, notes, videoUrl: null })

const ROUTINE_DAYS = [
  {
    day: 'Día 1', focus: 'Upper',
    exercises: [
      ex('Press inclinado en Smith', '2', '6-10'),
      ex('Jalón al pecho c/agarre amplio prono', '2', '6-10'),
      ex('Peck deck', '3', '6-10'),
      ex('Pull over', '2', '12-15'),
      ex('Remo sentado en polea unilateral', '2', '6-10'),
      ex('Elevaciones laterales c/mancuerna o polea', '4', '12-15'),
      ex('Curl bícep sentado unilateral', '2', '6-10'),
      ex('Press francés c/mancuerna', '2', '6-10'),
      ex('Banco Scott', '1', '6-10'),
      ex('Extensión de tríceps con barra', '1', '6-10'),
    ],
  },
  {
    day: 'Día 2', focus: 'Lower',
    exercises: [
      ex('Aductores', '3', '12-15'),
      ex('Sentadilla Smith', '3', '6-10'),
      ex('Prensa', '2', '10-15'), // reps confirmadas por el coach (planilla ilegible "19-1")
      ex('Hip thrust en máquina', '3', '6-10'),
      ex('Extensión de cuádriceps', '3', '12-15'),
      ex('Extensión de isquios', '3', '12-15'),
      ex('Gemelos', '2', '12-15'),
    ],
  },
  {
    day: 'Día 3', focus: 'Hombro + Brazo',
    exercises: [
      ex('Press militar', '2', '6-10'),
      ex('Elevaciones laterales mancuerna', '3', '12-15'),
      ex('Posterior en polea', '3', '6-10'),
      ex('Press francés', '3', '6-10'),
      ex('Elevaciones laterales polea', '3', '12-15'),
      ex('Curl de bícep unilateral sentado', '3', '6-10'),
      ex('Extensión tríceps polea alta unilateral', '3', '6-10'),
      ex('Curl Bayesian', '3', '6-10'),
    ],
  },
  {
    day: 'Día 4', focus: 'Pecho + Espalda',
    exercises: [
      ex('Press inclinado Smith', '3', '6-10'),
      ex('Jalón pecho agarre amplio', '3', '6-10'),
      ex('Peck deck', '3', '8-10'),
      ex('Pull over', '3', '6-10'),
      ex('Remo c/ barra en Smith', '2', '6-10'),
      ex('Remo sentado en polea', '2', '6-10'),
    ],
  },
  {
    day: 'Día 5', focus: 'Lower',
    exercises: [
      ex('Peso muerto c/ barra', '3', '12-15'),
      ex('Prensa', '3', '6-10'),
      ex('Hip thrust en máquina', '2', '8-10'), // reps confirmadas por el coach (planilla ilegible "19-1")
      ex('Extensión de isquios', '3', '6-10'),
      ex('Extensión de cuádriceps', '3', '6-10'),
      ex('Aductores', '3', '12-15'),
      ex('Gemelos', '2', '12-15'),
    ],
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────────
function readEnvLocal(name) {
  try {
    const env = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
    const m = env.match(new RegExp('^' + name + '=(.*)$', 'm'))
    return m ? m[1].trim() : null
  } catch { return null }
}
function exit(msg) { console.error('\n✗ ' + msg + '\n'); process.exit(1) }
const shortId = (id) => String(id).slice(0, 8)

const PALETTE = ['#6c63ff', '#22c55e', '#f59e0b', '#ec4899', '#0ea5e9', '#a855f7', '#ef4444']
function initialsOf(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
}
function colorOf(slug) {
  let h = 0; for (const c of slug) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]
}
const countOptions = (meals) => meals.reduce((s, sc) => s + sc.meals.reduce((a, m) => a + m.options.length, 0), 0)
const countExercises = (days) => days.reduce((s, d) => s + d.exercises.length, 0)

// ── Resolución del coach (clients.coach_id → public.profiles.id) ──────────────
async function getProfileById(sb, id) {
  const { data, error } = await sb.from('profiles').select('id, full_name, role').eq('id', id).maybeSingle()
  if (error) throw new Error('Error consultando public.profiles: ' + error.message)
  return data || null
}
async function findAuthUserByEmail(sb, email) {
  const target = email.trim().toLowerCase()
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error('No se pudo listar usuarios de auth (Admin API): ' + error.message)
    const users = data?.users || []
    const hit = users.find((u) => (u.email || '').toLowerCase() === target)
    if (hit) return hit
    if (users.length < 200) break
  }
  return null
}
async function resolveCoachId(sb) {
  const wantId = process.env.COACH_ID || null
  const wantEmail = process.env.COACH_EMAIL || null

  if (wantId) {
    const prof = await getProfileById(sb, wantId)
    if (prof) { console.log(`coach_id: ${shortId(prof.id)}… (${prof.full_name || 's/nombre'}) vía COACH_ID`); return prof.id }
    if (!wantEmail) throw new Error(`COACH_ID no existe en public.profiles (id=${shortId(wantId)}…). Usá COACH_EMAIL o un COACH_ID válido.`)
  }
  if (wantEmail) {
    const user = await findAuthUserByEmail(sb, wantEmail)
    if (!user) throw new Error(`No existe usuario de auth con email "${wantEmail}".`)
    const prof = await getProfileById(sb, user.id)
    if (!prof) throw new Error(`"${wantEmail}" existe en auth pero no tiene fila en public.profiles.`)
    console.log(`coach_id: ${shortId(prof.id)}… (${prof.full_name || 's/nombre'}) vía COACH_EMAIL`)
    return prof.id
  }
  const { data: coaches, error } = await sb.from('profiles').select('id, full_name, role').eq('role', 'coach').limit(2)
  if (error) throw new Error('No se pudo consultar public.profiles: ' + error.message)
  if (!coaches?.length) throw new Error("No hay ningún profile con role='coach'. Definí COACH_EMAIL o COACH_ID.")
  if (coaches.length > 1) throw new Error("Hay más de un coach. Definí COACH_EMAIL o COACH_ID para elegir.")
  console.log(`coach_id: ${shortId(coaches[0].id)}… (${coaches[0].full_name || 's/nombre'}) vía profiles.role='coach'`)
  return coaches[0].id
}

// ── Vínculo opcional de login (solo si se enviaron credenciales) ──────────────
async function maybeLinkLogin(sb, clientId, errors) {
  const email = process.env.ALEJANDRO_LOGIN_EMAIL || null
  const password = process.env.ALEJANDRO_LOGIN_PASSWORD || null

  if (!email) {
    console.log('  Login: PENDIENTE — no se envió ALEJANDRO_LOGIN_EMAIL. No se crea ni se inventa nada.')
    return
  }
  console.log(`  Login: vincular usuario "${email}" (rol 'client').`)
  if (!APPLY) { console.log('    (se crea/vincula al aplicar con --apply)'); return }
  if (!clientId || clientId === '(se crea al aplicar)') { console.log('    ⚠ sin clientId todavía — se omite el vínculo.'); return }

  try {
    let user = await findAuthUserByEmail(sb, email)
    if (!user) {
      // El usuario NO existe en auth: solo se crea si se pasó contraseña (no se inventa).
      if (!password) {
        console.log('    ⚠ el usuario no existe en auth y no se pasó ALEJANDRO_LOGIN_PASSWORD → no se crea.')
        console.log('      Definí la contraseña por env, o creá el usuario en Supabase y reejecutá para vincularlo.')
        return
      }
      const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true })
      if (error) throw error
      user = data.user
      console.log(`    ✓ usuario de auth creado (id=${shortId(user.id)}…)`)
    } else {
      console.log(`    · usuario de auth ya existía (id=${shortId(user.id)}…) — se vincula sin tocar su contraseña.`)
    }
    // profile rol 'client' (la FK clients.user_id → profiles.id lo exige).
    const { error: pErr } = await sb.from('profiles')
      .upsert({ id: user.id, full_name: FULL_NAME, role: 'client' }, { onConflict: 'id' })
    if (pErr) throw pErr
    const { error: cErr } = await sb.from('clients').update({ user_id: user.id, email }).eq('id', clientId)
    if (cErr) throw cErr
    console.log('    ✓ profile + clients.user_id vinculados.')
  } catch (e) {
    console.log('    ✗ error vinculando login:', e.message)
    errors.push({ step: 'login.link', message: e.message })
  }
}

// ── Verificación read-only ────────────────────────────────────────────────────
async function verify(sb) {
  console.log(`\n=== Verificación Alejandro Martínez  [READ-ONLY] ===\n── slug='${SLUG}' ──`)
  const { data: client, error } = await sb.from('clients')
    .select('id, slug, full_name, objective, age, weight, height, weekly_goal, status, user_id')
    .eq('slug', SLUG).maybeSingle()
  if (error) return console.log('  ✗ error consultando clients:', error.message)
  if (!client) return console.log('  clients: NO EXISTE')
  console.log(`  clients: EXISTE id=${shortId(client.id)}… "${client.full_name}" · obj=${client.objective ?? '—'} · ${client.weight ?? '—'}kg/${client.height ?? '—'}cm · ${client.age ?? '—'} años · meta="${client.weekly_goal ?? '—'}" · login=${client.user_id ? 'vinculado' : 'PENDIENTE'}`)

  const { data: nps } = await sb.from('nutrition_plans').select('id, calories, protein, carbs, fats, meals, active').eq('client_id', client.id)
  if (!nps?.length) console.log('  nutrition_plans: 0')
  else {
    const a = nps.find((n) => n.active) || nps[0]
    const nOpts = Array.isArray(a.meals) ? countOptions(a.meals) : 0
    console.log(`  nutrition_plans: ${nps.length} (activos: ${nps.filter((n) => n.active).length}) · ${a.calories ?? '—'}kcal P${a.protein ?? '—'}/C${a.carbs ?? '—'}/G${a.fats ?? '—'} · ${Array.isArray(a.meals) ? a.meals.length : 0} esquemas, ${nOpts} opciones`)
  }
  const { data: wps } = await sb.from('workout_plans').select('id, title, days, active').eq('client_id', client.id)
  if (!wps?.length) console.log('  workout_plans: 0')
  else {
    const a = wps.find((w) => w.active) || wps[0]
    const nDays = Array.isArray(a.days) ? a.days.length : 0
    console.log(`  workout_plans: ${wps.length} (activos: ${wps.filter((w) => w.active).length}) · ${nDays} días, ${Array.isArray(a.days) ? countExercises(a.days) : 0} ejercicios`)
  }
  console.log('')
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const url = process.env.SUPABASE_URL || readEnvLocal('VITE_SUPABASE_URL')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const missing = []
  if (!key) missing.push('SUPABASE_SERVICE_ROLE_KEY  (del entorno; nunca de archivos)')
  if (!url) missing.push('SUPABASE_URL  (o VITE_SUPABASE_URL en .env.local)')
  if (missing.length) exit('Faltan variables de entorno:\n   - ' + missing.join('\n   - ') +
    "\n\n   PowerShell:\n     $env:SUPABASE_SERVICE_ROLE_KEY='<service-role-key>'\n     $env:SUPABASE_URL='https://<ref>.supabase.co'   # opcional si está en .env.local")

  const sb = createClient(url, key, { auth: { persistSession: false } })

  if (VERIFY) return verify(sb)

  console.log(`\n=== Alta Alejandro Martínez  [${APPLY ? 'APPLY' : 'DRY-RUN'}] ===`)
  console.log(`Nutrición: ${NUTRITION.calories} kcal · ${MEALS.length} esquemas · ${countOptions(MEALS)} opciones`)
  console.log(`Rutina: ${ROUTINE_DAYS.length} días · ${countExercises(ROUTINE_DAYS)} ejercicios`)
  const pendingReps = ROUTINE_DAYS.flatMap((d) => d.exercises.filter((e) => e.reps == null).map((e) => `${d.day} · ${e.name}`))
  if (pendingReps.length) console.log(`⚠ Reps SIN cargar (ilegibles en la planilla, a confirmar): ${pendingReps.join('  |  ')}`)

  let coachId
  try { coachId = await resolveCoachId(sb) } catch (e) { exit(e.message) }

  const errors = []

  // 1) clients — upsert por slug. Crea si no existe; si existe, actualiza SOLO sus campos.
  const { data: existing, error: exErr } = await sb.from('clients').select('*').eq('slug', SLUG).maybeSingle()
  if (exErr) exit('Error leyendo clients: ' + exErr.message)
  let clientId = existing?.id ?? null

  const clientFields = {
    full_name: FULL_NAME,
    objective: PROFILE.objective,
    age: PROFILE.age,
    weight: PROFILE.weight,
    height: PROFILE.height,
    weekly_goal: PROFILE.weekly_goal,
    status: 'active',
  }

  if (existing) {
    const updates = {}
    for (const [k, v] of Object.entries(clientFields)) if (String(existing[k] ?? '') !== String(v ?? '')) updates[k] = v
    console.log(`  DB clients: EXISTE (id=${shortId(clientId)}…) · actualizar: ${Object.keys(updates).length ? JSON.stringify(updates) : '— (ya coincide)'}`)
    if (APPLY && Object.keys(updates).length) {
      const { error } = await sb.from('clients').update(updates).eq('id', clientId)
      if (error) { console.log('    ✗ error update clients:', error.message); errors.push({ step: 'clients.update', message: error.message }) }
    }
  } else {
    const payload = {
      coach_id: coachId, slug: SLUG, ...clientFields,
      avatar_initials: initialsOf(FULL_NAME), avatar_color: colorOf(SLUG),
    }
    console.log('  DB clients: CREAR →', JSON.stringify({ slug: SLUG, full_name: FULL_NAME, weight: PROFILE.weight, height: PROFILE.height, age: PROFILE.age }))
    if (APPLY) {
      const { data, error } = await sb.from('clients').insert(payload).select('id').single()
      if (error) { console.log('    ✗ error insert clients:', error.message); errors.push({ step: 'clients.insert', message: error.message }); return finish(errors) }
      clientId = data.id
    }
  }
  if (!clientId && !APPLY) clientId = '(se crea al aplicar)'

  // 2) nutrition_plans — idempotente: actualiza el plan activo o lo crea. Nunca duplica.
  const nutFields = { calories: NUTRITION.calories, protein: NUTRITION.protein, carbs: NUTRITION.carbs, fats: NUTRITION.fats, meals: MEALS, notes: NUTRITION.notes }
  if (clientId && clientId !== '(se crea al aplicar)') {
    const { data: np } = await sb.from('nutrition_plans').select('id').eq('client_id', clientId).eq('active', true).limit(1)
    if (np?.length) {
      console.log(`  DB nutrition_plans: ACTUALIZAR plan activo (id=${shortId(np[0].id)}…) → ${countOptions(MEALS)} opciones.`)
      if (APPLY) {
        const { error } = await sb.from('nutrition_plans').update(nutFields).eq('id', np[0].id)
        if (error) { console.log('    ✗ error update nutrition_plans:', error.message); errors.push({ step: 'nutrition_plans.update', message: error.message }) }
      }
    } else {
      console.log(`  DB nutrition_plans: CREAR → ${countOptions(MEALS)} opciones.`)
      if (APPLY) {
        const { error } = await sb.from('nutrition_plans').insert({ coach_id: coachId, client_id: clientId, active: true, ...nutFields })
        if (error) { console.log('    ✗ error insert nutrition_plans:', error.message); errors.push({ step: 'nutrition_plans.insert', message: error.message }) }
      }
    }
  } else {
    console.log('  DB nutrition_plans: CREAR al aplicar (cliente nuevo).')
  }

  // 3) workout_plans — idempotente: actualiza el plan activo o lo crea. Nunca duplica.
  const title = `Rutina ${ROUTINE_DAYS.length} días — ${ROUTINE_DAYS.map((d) => d.focus).join(' / ')}`.slice(0, 180)
  if (clientId && clientId !== '(se crea al aplicar)') {
    const { data: wp } = await sb.from('workout_plans').select('id').eq('client_id', clientId).eq('active', true).limit(1)
    if (wp?.length) {
      console.log(`  DB workout_plans: ACTUALIZAR plan activo (id=${shortId(wp[0].id)}…) → ${ROUTINE_DAYS.length} días.`)
      if (APPLY) {
        const { error } = await sb.from('workout_plans').update({ title, days: ROUTINE_DAYS }).eq('id', wp[0].id)
        if (error) { console.log('    ✗ error update workout_plans:', error.message); errors.push({ step: 'workout_plans.update', message: error.message }) }
      }
    } else {
      console.log('  DB workout_plans: CREAR →', title)
      if (APPLY) {
        const { error } = await sb.from('workout_plans').insert({ coach_id: coachId, client_id: clientId, active: true, title, days: ROUTINE_DAYS, exercises: [], notes: null })
        if (error) { console.log('    ✗ error insert workout_plans:', error.message); errors.push({ step: 'workout_plans.insert', message: error.message }) }
      }
    }
  } else {
    console.log('  DB workout_plans: CREAR al aplicar (cliente nuevo).')
  }

  // 4) Login (opcional, solo si se enviaron credenciales por env).
  await maybeLinkLogin(sb, clientId, errors)

  finish(errors)
}

function finish(errors) {
  if (!APPLY) { console.log('\n✓ DRY-RUN OK: no se escribió nada. Reejecutá con --apply para aplicar.\n'); return }
  if (errors.length) {
    console.error('\n✗ APPLY falló')
    for (const e of errors) console.error(`   - ${e.step}: ${e.message}`)
    process.exit(1)
  }
  console.log('\n✓ APPLY OK — Alejandro cargado sin errores.\n')
}

main().catch((e) => exit(e.message))
