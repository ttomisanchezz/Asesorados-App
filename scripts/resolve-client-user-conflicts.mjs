// =============================================================================
// resolve-client-user-conflicts.mjs
// Resuelve conflictos donde un client VIEJO/de prueba ocupa el user_id que le
// corresponde al client CANÓNICO importado. Mueve el user_id viejo→canónico de
// forma SEGURA, sin borrar nada.
//
// QUÉ HACE (y qué NO):
//   - NO borra clients, planes, métricas, logs ni usuarios. NO cambia passwords.
//   - NO imprime passwords ni la service_role key.
//   - Inspecciona datos reales del client viejo antes de decidir.
//   - Si el client viejo tiene actividad real (progreso/checkins/sesiones/logs) NO
//     resuelve automáticamente: lo reporta y pide decisión.
//   - Si es claramente de prueba (sin actividad) mueve el user_id al canónico,
//     desactiva el viejo (status='finished', NO existe columna 'active') y deja
//     una nota en internal_notes. Idempotente.
//   - DRY-RUN por defecto. --apply escribe. --verify es solo lectura. exit 1 si falla.
//   - Solo toca los pares declarados (eze/ezequiel, tomi/tomi-asesorado). NO toca
//     lu, ro, santi, ni mateo (mateo ya está OK; se muestra su estado).
//
// USO (PowerShell):
//   $env:SUPABASE_SERVICE_ROLE_KEY='...'; node scripts/resolve-client-user-conflicts.mjs           # dry-run
//   $env:SUPABASE_SERVICE_ROLE_KEY='...'; node scripts/resolve-client-user-conflicts.mjs --apply    # escribe
//   $env:SUPABASE_SERVICE_ROLE_KEY='...'; node scripts/resolve-client-user-conflicts.mjs --verify   # verifica
//
//   Flags: --apply  --verify  --force (permite reasignar aunque el canónico ya tenga otro user_id)
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

// Pares de conflicto declarados explícitamente (no se adivina).
const PAIRS = [
  { canonical: 'eze',  expected: 'Ezequiel Huenqueo', legacy: 'ezequiel' },
  { canonical: 'tomi', expected: 'Tomás Villegas',    legacy: 'tomi-asesorado' },
]
// Slugs que solo se reportan (no son conflicto): mateo OK, giselle pendiente.
const STATUS_ONLY = [
  { slug: 'mateo',   expected: 'Mateo Braghero' },
  { slug: 'giselle', expected: 'Brenda Giselle Ninancoro' },
]

// Tablas que cuelgan de client_id. ACTIVITY = datos generados por el asesorado
// (si hay >0, el viejo NO es "de prueba" → no se resuelve solo).
const PLAN_TABLES = ['nutrition_plans', 'workout_plans']
const ACTIVITY_TABLES = ['progress_metrics', 'checkins', 'workout_sessions', 'workout_exercise_logs']
const ALL_TABLES = [...PLAN_TABLES, ...ACTIVITY_TABLES]

const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const compact = (s) => norm(s).replace(/[^a-z0-9]/g, '')
const shortId = (id) => (id ? String(id).slice(0, 8) + '…' : '—')
function exit(msg) { console.error('\n✗ ' + msg + '\n'); process.exit(1) }
function readEnvLocal(name) {
  try {
    const env = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
    const m = env.match(new RegExp('^' + name + '=(.*)$', 'm'))
    return m ? m[1].trim() : null
  } catch { return null }
}

async function getClientBySlug(sb, slug) {
  const { data, error } = await sb.from('clients')
    .select('id, slug, full_name, email, user_id, status, objective, internal_notes')
    .eq('slug', slug).maybeSingle()
  if (error) throw new Error(`clients(${slug}): ${error.message}`)
  return data
}
async function getAuthEmailById(sb, id) {
  if (!id) return null
  const { data, error } = await sb.auth.admin.getUserById(id)
  if (error) return null
  return data?.user?.email || null
}
async function countsFor(sb, clientId) {
  const out = {}
  for (const t of ALL_TABLES) {
    const { count, error } = await sb.from(t).select('*', { count: 'exact', head: true }).eq('client_id', clientId)
    out[t] = error ? null : (count ?? 0)
  }
  return out
}
function activitySum(counts) {
  // null = no se pudo contar → lo tratamos como "no verificable" (bloquea por seguridad).
  let sum = 0
  for (const t of ACTIVITY_TABLES) { if (counts[t] == null) return null; sum += counts[t] }
  return sum
}
function fmtCounts(c) {
  return ALL_TABLES.map((t) => `${t.replace(/_/g, ' ')}=${c[t] == null ? '?' : c[t]}`).join(' · ')
}
// ¿El email se relaciona con el canónico? (guarda contra mover el user equivocado)
function emailRelatesTo(slug, expectedName, email) {
  const local = compact((email || '').split('@')[0])
  if (!local) return false
  const toks = [compact(slug), ...(expectedName || '').split(/\s+/).map(compact)].filter((t) => t.length >= 3)
  return toks.some((t) => local === t || local.startsWith(t) || (t.length >= 4 && local.includes(t)))
}

async function ensureProfileClient(sb, userId, fullName, slug, errors) {
  const { data: prof, error } = await sb.from('profiles').select('id, role').eq('id', userId).maybeSingle()
  if (error) { errors.push({ slug, step: 'profiles.select', message: error.message }); return false }
  if (!prof) {
    const { error: e2 } = await sb.from('profiles').insert({ id: userId, full_name: fullName, role: 'client' })
    if (e2) { errors.push({ slug, step: 'profiles.insert', message: e2.message }); return false }
    console.log('    · profile creado (role=client)')
    return true
  }
  if (prof.role === 'coach') { errors.push({ slug, step: 'profiles.role', message: "profile es 'coach'" }); console.log("    ✗ profile es role='coach' — no se toca"); return false }
  if (prof.role !== 'client') {
    const { error: e3 } = await sb.from('profiles').update({ role: 'client' }).eq('id', userId)
    if (e3) { errors.push({ slug, step: 'profiles.update', message: e3.message }); return false }
    console.log(`    · profile role ${prof.role}→client`)
  }
  return true
}

// ── Resolver un par ───────────────────────────────────────────────────────────
async function resolvePair(sb, pair, errors, blocked) {
  const { canonical, expected, legacy } = pair
  console.log(`\n${'─'.repeat(64)}\n▶ conflicto: legacy '${legacy}'  →  canónico '${canonical}' (${expected})`)

  const cClient = await getClientBySlug(sb, canonical)
  const lClient = await getClientBySlug(sb, legacy)

  if (!cClient) { console.log(`  ✗ no existe el client canónico slug='${canonical}'`); errors.push({ slug: canonical, step: 'canonical.missing', message: 'no existe' }); return }
  if (cClient.full_name !== expected) {
    console.log(`  ✗ canónico full_name ("${cClient.full_name}") ≠ esperado ("${expected}") — abortado por seguridad`)
    errors.push({ slug: canonical, step: 'canonical.name', message: 'full_name no coincide' }); return
  }

  // estado del legacy
  if (!lClient) {
    console.log(`  · no existe client legacy slug='${legacy}' (quizá ya limpiado).`)
  } else {
    const lc = await countsFor(sb, lClient.id)
    const lEmail = await getAuthEmailById(sb, lClient.user_id)
    console.log(`  LEGACY  ${legacy}: id=${shortId(lClient.id)} "${lClient.full_name}" status=${lClient.status} user_id=${shortId(lClient.user_id)} (${lEmail ?? '—'}) email=${lClient.email ?? '—'} obj=${lClient.objective ?? '—'}`)
    console.log(`          datos: ${fmtCounts(lc)}`)
  }
  const cc = await countsFor(sb, cClient.id)
  console.log(`  CANÓNICO ${canonical}: id=${shortId(cClient.id)} "${cClient.full_name}" status=${cClient.status} user_id=${shortId(cClient.user_id)} email=${cClient.email ?? '—'}`)
  console.log(`          datos: ${fmtCounts(cc)}`)

  // ── Determinar el user_id a mover ──
  const movingUserId = lClient?.user_id || null

  // Idempotencia / estados sin nada para mover
  if (!movingUserId) {
    if (cClient.user_id) { console.log('  ✓ YA RESUELTO: legacy sin user_id y canónico vinculado.'); return }
    console.log('  · legacy sin user_id y canónico tampoco vinculado → nada que mover acá. Usá auto-link para giselle/otros.')
    return
  }

  // Si el canónico ya tiene ESTE user → solo falta desvincular el legacy.
  const canonicalAlreadyHasUser = cClient.user_id === movingUserId
  if (cClient.user_id && !canonicalAlreadyHasUser && !FORCE) {
    console.log(`  ✗ el canónico ya tiene OTRO user_id=${shortId(cClient.user_id)}. No se pisa sin --force.`)
    blocked.push({ slug: canonical, reason: 'canónico ya vinculado a otro usuario (requiere --force o decisión)' })
    return
  }

  // Guarda: el email del user que vamos a mover debe relacionarse con el canónico.
  const movingEmail = await getAuthEmailById(sb, movingUserId)
  if (!emailRelatesTo(canonical, expected, movingEmail)) {
    console.log(`  ✗ el email del user a mover (${movingEmail ?? '—'}) NO se relaciona con '${canonical}'. Abortado por seguridad.`)
    blocked.push({ slug: canonical, reason: `email ${movingEmail ?? '—'} no parece de ${canonical}` })
    return
  }

  // Seguridad: ¿el legacy tiene actividad real?
  const lc = await countsFor(sb, lClient.id)
  const act = activitySum(lc)
  if (act == null) {
    console.log('  ✗ no se pudieron contar todas las tablas de actividad del legacy → NO se resuelve (seguridad).')
    blocked.push({ slug: canonical, reason: 'conteo de actividad no verificable' })
    return
  }
  if (act > 0) {
    console.log(`  ⚠ el legacy tiene ACTIVIDAD REAL (${act} registros de progreso/checkins/sesiones/logs). NO se migra automáticamente.`)
    console.log('    Decisión humana requerida: indicá si querés conservar esa actividad o abandonarla.')
    blocked.push({ slug: canonical, reason: `legacy con actividad real (${act})` })
    return
  }
  console.log('  ✓ legacy sin actividad real → es seguro mover el user_id.')

  // ── Plan de cambios ──
  const planLegacy = []
  if (lClient.user_id) planLegacy.push('user_id→NULL')
  if (lClient.status !== 'finished') planLegacy.push("status→'finished'")
  const noteTag = `[legacy duplicate de '${canonical}' — user_id reasignado]`
  const needNote = !(lClient.internal_notes || '').includes(noteTag)
  if (needNote) planLegacy.push('internal_notes+=nota')

  const canonUpdates = {}
  if (!canonicalAlreadyHasUser) canonUpdates.user_id = movingUserId
  if (!cClient.email && movingEmail) canonUpdates.email = movingEmail

  console.log(`  ${APPLY ? 'APLICANDO' : 'APLICARÍA'}:`)
  console.log(`    legacy '${legacy}': ${planLegacy.length ? planLegacy.join(', ') : '— (ya desactivado)'}`)
  console.log(`    canónico '${canonical}': ${Object.keys(canonUpdates).length ? JSON.stringify({ ...canonUpdates, user_id: canonUpdates.user_id ? shortId(canonUpdates.user_id) : undefined }) : '— (ya vinculado)'}`)
  console.log(`    profile ${shortId(movingUserId)}: asegurar role='client'`)

  if (!APPLY) return

  // ── Escritura: 1) desvincular legacy  2) vincular canónico  3) profile ──
  // Orden importante: primero liberar el user_id del legacy para no dejar dos
  // clients con el mismo user_id (rompería el .single() del panel).
  const legacyUpdates = {}
  if (lClient.user_id) legacyUpdates.user_id = null
  if (lClient.status !== 'finished') legacyUpdates.status = 'finished'
  if (needNote) legacyUpdates.internal_notes = [lClient.internal_notes, noteTag].filter(Boolean).join(' ')
  if (Object.keys(legacyUpdates).length) {
    const { error } = await sb.from('clients').update(legacyUpdates).eq('id', lClient.id)
    if (error) { errors.push({ slug: legacy, step: 'legacy.update', message: error.message }); console.log('    ✗ error desvinculando legacy:', error.message); return }
    console.log('    ✓ legacy desvinculado/desactivado')
  }

  if (Object.keys(canonUpdates).length) {
    const { error } = await sb.from('clients').update(canonUpdates).eq('id', cClient.id)
    if (error) { errors.push({ slug: canonical, step: 'canonical.update', message: error.message }); console.log('    ✗ error vinculando canónico:', error.message); return }
    console.log('    ✓ canónico vinculado')
  }

  await ensureProfileClient(sb, movingUserId, cClient.full_name, canonical, errors)
  console.log('  ✓ conflicto resuelto')
}

// ── Verificación read-only ────────────────────────────────────────────────────
async function verifyOne(sb, slug) {
  console.log(`\n── ${slug} ──`)
  const client = await getClientBySlug(sb, slug)
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
  console.log(`  status         : ${client.status}`)
  console.log(`  clients.email  : ${client.email ?? '—'}`)
  console.log(`  clients.user_id: ${client.user_id ? shortId(client.user_id) : '✗ SIN VINCULAR'}`)
  console.log(`  auth.email     : ${authEmail ?? '—'}`)
  console.log(`  profiles.role  : ${role}`)
  console.log(`  nutrition plan : ${np?.length ? 'activo' : 'no'}`)
  console.log(`  workout plan   : ${wp?.length ? 'activo' : 'no'}`)
}

// Devuelve una fila para la tabla final de verificación (deliverable #7).
async function verifyRow(sb, slug) {
  const c = await getClientBySlug(sb, slug)
  if (!c) return [slug, '(no existe)', '—', '—', '—', '—', '—', '—', '—']
  const authEmail = await getAuthEmailById(sb, c.user_id)
  let role = '—'
  if (c.user_id) {
    const { data: prof } = await sb.from('profiles').select('role').eq('id', c.user_id).maybeSingle()
    role = prof?.role ?? '(sin profile)'
  }
  const { data: np } = await sb.from('nutrition_plans').select('id').eq('client_id', c.id).eq('active', true).limit(1)
  const { data: wp } = await sb.from('workout_plans').select('id').eq('client_id', c.id).eq('active', true).limit(1)
  return [
    slug,
    c.full_name,
    c.email ?? '—',
    c.user_id ? shortId(c.user_id) : '✗ sin vincular',
    authEmail ?? '—',
    role,
    np?.length ? 'activo' : 'no',
    wp?.length ? 'activo' : 'no',
    c.status,
  ]
}

// Imprime una tabla alineada: slug | full_name | email | user_id | auth | role | nut | wk | estado.
function printVerifyTable(rows) {
  const head = ['slug', 'full_name', 'clients.email', 'clients.user_id', 'auth.email', 'profile.role', 'nutrition', 'workout', 'estado']
  const all = [head, ...rows]
  const widths = head.map((_, i) => Math.max(...all.map((r) => String(r[i]).length)))
  const fmt = (r) => r.map((c, i) => String(c).padEnd(widths[i])).join('  ')
  console.log('\n' + fmt(head))
  console.log(widths.map((w) => '─'.repeat(w)).join('  '))
  for (const r of rows) console.log(fmt(r))
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

  if (VERIFY) {
    console.log('\n=== Estado post-resolución  [VERIFY · solo lectura] ===')
    for (const p of PAIRS) { await verifyOne(sb, p.legacy); await verifyOne(sb, p.canonical) }
    for (const s of STATUS_ONLY) await verifyOne(sb, s.slug)
    // Tabla final compacta (deliverable #7): canónicos + legacy + status-only.
    const slugs = [...PAIRS.flatMap((p) => [p.canonical, p.legacy]), ...STATUS_ONLY.map((s) => s.slug)]
    const rows = []
    for (const slug of slugs) rows.push(await verifyRow(sb, slug))
    printVerifyTable(rows)
    console.log('')
    return
  }

  console.log(`\n=== Resolver conflictos client↔user  [${APPLY ? 'APPLY' : 'DRY-RUN'}] ===`)
  const errors = []
  const blocked = []
  for (const p of PAIRS) await resolvePair(sb, p, errors, blocked)

  // Estado de los que no son conflicto (mateo OK, giselle pendiente)
  console.log(`\n${'─'.repeat(64)}\n▶ estado (sin conflicto):`)
  for (const s of STATUS_ONLY) {
    const c = await getClientBySlug(sb, s.slug)
    if (!c) { console.log(`  ${s.slug}: NO EXISTE`); continue }
    const email = await getAuthEmailById(sb, c.user_id)
    console.log(`  ${s.slug}: ${c.user_id ? `vinculado → ${email ?? shortId(c.user_id)}` : 'SIN VINCULAR'} (${c.full_name}, status=${c.status})`)
    if (s.slug === 'giselle' && !c.user_id) console.log('     ↳ PENDIENTE: falta crear usuario Auth para Giselle o el email no matchea. No se inventa.')
  }

  // Resumen + exit code
  console.log(`\n— Resumen ${APPLY ? 'apply' : 'dry-run'} —`)
  if (blocked.length) { console.log('  requieren decisión:'); for (const b of blocked) console.log(`   · ${b.slug}: ${b.reason}`) }
  if (errors.length) {
    console.error('\n✗ Con errores:')
    for (const e of errors) console.error(`   - ${e.slug} · ${e.step}: ${e.message}`)
    console.error('')
    process.exit(1)
  }
  if (!APPLY) {
    console.log('\n✓ DRY-RUN OK: no se escribió nada. Reejecutá con --apply para resolver los conflictos seguros.\n')
    return
  }
  if (blocked.length) { console.error('\n✗ APPLY incompleto: quedan conflictos que requieren tu decisión (ver arriba).\n'); process.exit(1) }
  console.log('\n✓ APPLY OK — conflictos resueltos sin errores.\n')
}

main().catch((e) => exit(e.message))
