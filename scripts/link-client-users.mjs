// =============================================================================
// link-client-users.mjs  —  Vincula usuarios de auth.users con public.clients.
//
// QUÉ HACE (y qué NO):
//   - NO crea usuarios ni passwords. NO imprime ni guarda passwords NUNCA.
//   - Lee un mapping slug→email desde un archivo LOCAL git-ignored.
//   - Por cada mapping: matchea client por slug EXACTO y auth user por email EXACTO,
//     asegura el profile (id = auth.users.id, role='client') y setea clients.user_id.
//   - DRY-RUN por defecto. Escribe solo con --apply. --verify es solo lectura.
//   - Idempotente. NO pisa un user_id existente que apunte a otro usuario (salvo --force).
//   - Guarda contra registros viejos/de prueba comparando full_name esperado por slug.
//
// USO (PowerShell):
//   $env:SUPABASE_SERVICE_ROLE_KEY='...'; node scripts/link-client-users.mjs            # dry-run
//   $env:SUPABASE_SERVICE_ROLE_KEY='...'; node scripts/link-client-users.mjs --apply     # escribe
//   $env:SUPABASE_SERVICE_ROLE_KEY='...'; node scripts/link-client-users.mjs --verify     # verifica
//
//   Mapping: scripts/client-user-map.local.json  (git-ignored; copiá el .example.json y completá emails)
//   Override del path: $env:CLIENT_USER_MAP='ruta/al/map.json'
//
// SALIDA: exit 0 si todo OK; exit 1 si hay conflictos (dry-run) o si falla algún write (apply).
// La service_role key se toma SOLO del entorno y NUNCA se imprime.
// =============================================================================

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const APPLY = process.argv.includes('--apply')
const VERIFY = process.argv.includes('--verify')
const FORCE = process.argv.includes('--force')

// Nombres esperados por slug — guarda contra registros viejos/de prueba (p.ej. "Ezequiel", "Tomi Asesorado").
// Si el client del slug no coincide con esto, NO se vincula (corta con error).
const EXPECTED_NAME = {
  eze: 'Ezequiel Huenqueo',
  giselle: 'Brenda Giselle Ninancoro',
  tomi: 'Tomás Villegas',
  mateo: 'Mateo Braghero',
}

const shortId = (id) => (id ? String(id).slice(0, 8) + '…' : '—')
function exit(msg) { console.error('\n✗ ' + msg + '\n'); process.exit(1) }
function readEnvLocal(name) {
  try {
    const env = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
    const m = env.match(new RegExp('^' + name + '=(.*)$', 'm'))
    return m ? m[1].trim() : null
  } catch { return null }
}

// ── Carga del mapping (archivo local git-ignored, nunca con passwords) ────────
function loadMapping() {
  const file = process.env.CLIENT_USER_MAP || path.join(__dirname, 'client-user-map.local.json')
  if (!fs.existsSync(file)) {
    exit(`No existe el archivo de mapping: ${path.relative(ROOT, file)}\n` +
      '   Copiá scripts/client-user-map.example.json → scripts/client-user-map.local.json y completá los emails reales.\n' +
      '   (el *.local.json está git-ignored — no se sube al repo)')
  }
  let arr
  try { arr = JSON.parse(fs.readFileSync(file, 'utf8')) }
  catch (e) { exit(`Mapping inválido (${path.relative(ROOT, file)}): ${e.message}`) }
  if (!Array.isArray(arr) || !arr.length) exit('El mapping debe ser un array no vacío de { slug, email }.')
  for (const m of arr) {
    if (!m.slug || !m.email) exit(`Cada entrada necesita slug y email. Entrada inválida: ${JSON.stringify(m)}`)
    if (/EMAIL_DE_|@ejemplo|@example/i.test(m.email)) exit(`Email placeholder sin completar para slug='${m.slug}': ${m.email}`)
  }
  return arr
}

async function findAuthUserByEmail(sb, email) {
  const target = email.trim().toLowerCase()
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error('No se pudo listar auth.users (Admin API): ' + error.message)
    const users = data?.users || []
    const hit = users.find((u) => (u.email || '').toLowerCase() === target)
    if (hit) return hit
    if (users.length < 200) break
  }
  return null
}

async function getAuthEmailById(sb, id) {
  if (!id) return null
  const { data, error } = await sb.auth.admin.getUserById(id)
  if (error) return null
  return data?.user?.email || null
}

// ── Vincular un mapping ───────────────────────────────────────────────────────
async function linkOne(sb, { slug, email }, errors) {
  console.log(`\n▶ ${slug}  ←  ${email}`)

  // 1) client por slug EXACTO (slug es unique en el schema → único registro correcto)
  const { data: client, error: cErr } = await sb.from('clients')
    .select('id, slug, full_name, email, user_id, coach_id').eq('slug', slug).maybeSingle()
  if (cErr) { console.log('  ✗ error consultando clients:', cErr.message); errors.push({ slug, step: 'clients.select', message: cErr.message }); return }
  if (!client) { console.log(`  ✗ no existe client con slug='${slug}'`); errors.push({ slug, step: 'clients.select', message: 'slug inexistente' }); return }
  console.log(`  client: "${client.full_name}"  id=${shortId(client.id)}  user_id=${shortId(client.user_id)}  email=${client.email ?? '—'}`)

  // 1.b) guarda anti-duplicados: el full_name debe coincidir con el esperado
  const expected = EXPECTED_NAME[slug]
  if (expected && client.full_name !== expected) {
    console.log(`  ✗ full_name ("${client.full_name}") != esperado ("${expected}"). Podría ser un registro viejo/de prueba — NO se vincula.`)
    errors.push({ slug, step: 'name.check', message: `full_name no coincide con el esperado (${expected})` })
    return
  }

  // 2) auth user por email EXACTO
  let user
  try { user = await findAuthUserByEmail(sb, email) }
  catch (e) { console.log('  ✗', e.message); errors.push({ slug, step: 'auth.list', message: e.message }); return }
  if (!user) { console.log(`  ✗ no existe auth user con email "${email}"`); errors.push({ slug, step: 'auth.find', message: 'email inexistente en auth.users' }); return }
  console.log(`  auth user: ${user.email}  id=${shortId(user.id)}`)

  // 3) conflicto: ese auth user ya vinculado a OTRO client
  const { data: others } = await sb.from('clients').select('id, slug, full_name').eq('user_id', user.id).neq('slug', slug).limit(1)
  if (others?.length) {
    const o = others[0]
    console.log(`  ✗ ese auth user ya está vinculado a otro client: slug='${o.slug}' ("${o.full_name}")`)
    errors.push({ slug, step: 'conflict.user', message: `auth user ya vinculado a slug='${o.slug}'` })
    return
  }

  // 4) conflicto: client.user_id ya seteado a otro usuario → no se pisa sin --force
  if (client.user_id && client.user_id !== user.id && !FORCE) {
    console.log(`  ✗ el client ya tiene user_id=${shortId(client.user_id)} (distinto). NO se pisa sin --force.`)
    errors.push({ slug, step: 'conflict.client', message: 'user_id ya apunta a otro usuario (usá --force para reescribir)' })
    return
  }

  // 5) profile: id = auth.users.id, role='client'
  const { data: prof, error: pErr } = await sb.from('profiles').select('id, full_name, role').eq('id', user.id).maybeSingle()
  if (pErr) { console.log('  ✗ error consultando profiles:', pErr.message); errors.push({ slug, step: 'profiles.select', message: pErr.message }); return }
  if (!prof) {
    console.log(`  profile: NO existe → ${APPLY ? 'CREAR' : 'CREARÍA'} { id=${shortId(user.id)}, role='client' }`)
    if (APPLY) {
      const { error } = await sb.from('profiles').insert({ id: user.id, full_name: client.full_name, role: 'client' })
      if (error) { console.log('    ✗ error insert profile:', error.message); errors.push({ slug, step: 'profiles.insert', message: error.message }); return }
    }
  } else if (prof.role === 'coach') {
    console.log(`  ✗ el profile de ese usuario tiene role='coach'. NO se degrada a 'client' automáticamente (conflicto).`)
    errors.push({ slug, step: 'profiles.role', message: "el profile es 'coach' — conflicto, no se toca" })
    return
  } else if (prof.role !== 'client') {
    console.log(`  profile: role='${prof.role}' → ${APPLY ? 'ACTUALIZAR' : 'ACTUALIZARÍA'} a 'client'`)
    if (APPLY) {
      const { error } = await sb.from('profiles').update({ role: 'client' }).eq('id', user.id)
      if (error) { console.log('    ✗ error update role:', error.message); errors.push({ slug, step: 'profiles.update', message: error.message }); return }
    }
  } else {
    console.log("  profile: OK (role='client')")
  }

  // 6) clients.user_id (+ email si está null)
  const updates = {}
  if (client.user_id !== user.id) updates.user_id = user.id
  if (!client.email) updates.email = email
  if (Object.keys(updates).length === 0) {
    console.log('  clients: ya vinculado (idempotente, sin cambios).')
  } else {
    const preview = { ...updates }
    if (preview.user_id) preview.user_id = shortId(preview.user_id)
    console.log(`  clients: ${APPLY ? 'ACTUALIZAR' : 'ACTUALIZARÍA'} → ${JSON.stringify(preview)}`)
    if (APPLY) {
      const { error } = await sb.from('clients').update(updates).eq('id', client.id)
      if (error) { console.log('    ✗ error update clients:', error.message); errors.push({ slug, step: 'clients.update', message: error.message }); return }
    }
  }
  console.log('  ✓ ' + (APPLY ? 'vinculado' : 'listo para vincular'))
}

// ── Verificación read-only ────────────────────────────────────────────────────
async function verifyOne(sb, { slug }) {
  console.log(`\n── ${slug} ──`)
  const { data: client } = await sb.from('clients')
    .select('id, slug, full_name, email, user_id').eq('slug', slug).maybeSingle()
  if (!client) { console.log('  clients: NO EXISTE'); return }

  const authEmail = await getAuthEmailById(sb, client.user_id)
  let role = '—'
  if (client.user_id) {
    const { data: prof } = await sb.from('profiles').select('role').eq('id', client.user_id).maybeSingle()
    role = prof?.role ?? '(sin profile)'
  }
  const { data: np } = await sb.from('nutrition_plans').select('id').eq('client_id', client.id).eq('active', true).limit(1)
  const { data: wp } = await sb.from('workout_plans').select('id').eq('client_id', client.id).eq('active', true).limit(1)

  console.log(`  full_name      : ${client.full_name}`)
  console.log(`  clients.email  : ${client.email ?? '—'}`)
  console.log(`  clients.user_id: ${client.user_id ? shortId(client.user_id) : '✗ SIN VINCULAR'}`)
  console.log(`  auth.email     : ${authEmail ?? '—'}`)
  console.log(`  profiles.role  : ${role}`)
  console.log(`  nutrition plan : ${np?.length ? 'activo' : 'no'}`)
  console.log(`  workout plan   : ${wp?.length ? 'activo' : 'no'}`)
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const url = process.env.SUPABASE_URL || readEnvLocal('VITE_SUPABASE_URL')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const missing = []
  if (!key) missing.push('SUPABASE_SERVICE_ROLE_KEY  (del entorno; nunca de archivos)')
  if (!url) missing.push('SUPABASE_URL  (o VITE_SUPABASE_URL en .env.local)')
  if (missing.length) {
    exit('Faltan variables de entorno:\n   - ' + missing.join('\n   - ') +
      '\n\n   PowerShell:  $env:SUPABASE_SERVICE_ROLE_KEY=\'<service-role-key>\'' +
      '\n   Bash:        export SUPABASE_SERVICE_ROLE_KEY=\'<service-role-key>\'')
  }

  const sb = createClient(url, key, { auth: { persistSession: false } })
  const mapping = loadMapping()

  if (VERIFY) {
    console.log('\n=== Vínculos auth ↔ clients  [VERIFY · solo lectura] ===')
    for (const m of mapping) await verifyOne(sb, m)
    console.log('')
    return
  }

  console.log(`\n=== Vincular auth ↔ clients  [${APPLY ? 'APPLY' : 'DRY-RUN'}] ===`)
  const errors = []
  for (const m of mapping) await linkOne(sb, m, errors)

  if (!APPLY) {
    if (errors.length) {
      console.error(`\n✗ DRY-RUN: hay ${errors.length} problema(s) a resolver ANTES del apply:`)
      for (const e of errors) console.error(`   - ${e.slug} · ${e.step}: ${e.message}`)
      console.error('')
      process.exit(1)
    }
    console.log('\n✓ DRY-RUN OK: no se escribió nada. Reejecutá con --apply para vincular.\n')
    return
  }
  if (errors.length) {
    console.error('\n✗ APPLY falló')
    for (const e of errors) console.error(`   - ${e.slug} · ${e.step}: ${e.message}`)
    console.error('')
    process.exit(1)
  }
  console.log('\n✓ APPLY OK — vínculos escritos sin errores.\n')
}

main().catch((e) => exit(e.message))
