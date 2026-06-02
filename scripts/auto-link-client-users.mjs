// =============================================================================
// auto-link-client-users.mjs — Vincula auth.users → public.clients.user_id
// detectando AUTOMÁTICAMENTE qué usuario de Auth corresponde a cada asesorado.
//
// QUÉ HACE (y qué NO):
//   - NO crea usuarios ni passwords. NO cambia passwords. NO imprime passwords NUNCA.
//   - NO imprime la service_role key.
//   - Descubre los auth users vía Admin API y los matchea por nombre/email (heurística).
//   - Solo vincula matches SEGUROS (confianza alta + candidato único + sin colisión).
//   - Ambiguo / sin match → NO vincula, lo reporta (muestra candidatos, sin passwords).
//   - DRY-RUN por defecto. --apply escribe. --verify es solo lectura.
//   - Idempotente. NO pisa un user_id existente que apunte a otro usuario (salvo --force).
//   - NO depende de ningún archivo mapping. (Opcional: --mapping usa client-user-map.local.json.)
//   - Solo toca slugs: eze, giselle, tomi, mateo. NO toca lu, ro, santi ni registros viejos.
//
// USO (PowerShell):
//   $env:SUPABASE_SERVICE_ROLE_KEY='...'; node scripts/auto-link-client-users.mjs           # dry-run
//   $env:SUPABASE_SERVICE_ROLE_KEY='...'; node scripts/auto-link-client-users.mjs --apply    # escribe
//   $env:SUPABASE_SERVICE_ROLE_KEY='...'; node scripts/auto-link-client-users.mjs --verify   # verifica
//   node scripts/auto-link-client-users.mjs --selftest    # prueba la heurística OFFLINE (sin DB ni key)
//
//   Flags: --apply  --verify  --force  --mapping  --selftest
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
const USE_MAPPING = process.argv.includes('--mapping')
const SELFTEST = process.argv.includes('--selftest')

// Slugs objetivo + nombre esperado (guarda anti-duplicados) + alias para el matching.
const TARGETS = [
  { slug: 'eze',     expected: 'Ezequiel Huenqueo',           aliases: ['ezequiel', 'eze', 'huenqueo'] },
  { slug: 'giselle', expected: 'Brenda Giselle Ninancoro',    aliases: ['giselle', 'brenda', 'ninancoro'] },
  { slug: 'tomi',    expected: 'Tomás Villegas',              aliases: ['tomi', 'tomas', 'villegas', 'tomiasesorado'] },
  { slug: 'mateo',   expected: 'Mateo Braghero',              aliases: ['mateo', 'braghero'] },
]

// ── Utilidades ────────────────────────────────────────────────────────────────
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

// Tokens del cliente (slug + partes del nombre + alias), compactados y dedupeados.
function clientTokens(target, fullName) {
  const parts = (fullName || '').split(/\s+/).map(compact)
  const all = [compact(target.slug), ...parts, ...target.aliases.map(compact)]
  return [...new Set(all.filter((t) => t.length >= 3))]
}

// Puntúa un email contra los tokens del cliente. Mayor = mejor.
//   100 exacto al slug · 90 empieza con slug/alias o === alias · 70/60 contiene · etc.
function scoreEmail(slugNorm, tokens, email) {
  const local = compact((email || '').split('@')[0])
  if (!local) return 0
  let best = 0
  const consider = (t, exact, starts, includes) => {
    if (!t || t.length < 3) return
    if (local === t) best = Math.max(best, exact)
    else if (local.startsWith(t)) best = Math.max(best, starts)
    else if (t.length >= 4 && local.includes(t)) best = Math.max(best, includes)
  }
  consider(slugNorm, 100, 90, 70)
  for (const t of tokens) consider(t, 90, 80, 60)
  return best
}

// Resuelve el match de un cliente contra la lista de usuarios.
// Devuelve { decision, confidence, chosen, candidates }.
//   decision: 'link' | 'review' | 'ambiguous' | 'notfound'
function resolveClient(target, fullName, users, mappingEmail) {
  const slugNorm = compact(target.slug)
  const tokens = clientTokens(target, fullName)

  // Modo --mapping: match EXACTO por el email del archivo, sin heurística.
  if (mappingEmail) {
    const u = users.find((x) => (x.email || '').toLowerCase() === mappingEmail.toLowerCase())
    if (!u) return { decision: 'notfound', confidence: 'mapping', chosen: null, candidates: [] }
    return { decision: 'link', confidence: 'alta (mapping)', chosen: u, candidates: [{ email: u.email, id: u.id, score: 100 }] }
  }

  const scored = users
    .map((u) => ({ email: u.email, id: u.id, score: scoreEmail(slugNorm, tokens, u.email), user: u }))
    .filter((c) => c.score >= 60)
    .sort((a, b) => b.score - a.score)

  if (!scored.length) return { decision: 'notfound', confidence: 'baja', chosen: null, candidates: [] }

  const top = scored[0]
  const second = scored[1]
  const unique = !second || (top.score - second.score) >= 30
  const high = top.score >= 80

  if (unique && high) return { decision: 'link', confidence: 'alta', chosen: top.user, candidates: scored }
  if (unique && !high) return { decision: 'review', confidence: 'media', chosen: null, candidates: scored }
  return { decision: 'ambiguous', confidence: 'media', chosen: null, candidates: scored }
}

// ── Acceso a datos ────────────────────────────────────────────────────────────
async function loadAllAuthUsers(sb) {
  const out = []
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error('No se pudo listar auth.users (Admin API): ' + error.message)
    const users = data?.users || []
    out.push(...users)
    if (users.length < 200) break
  }
  return out
}
async function getClientBySlug(sb, slug) {
  const { data, error } = await sb.from('clients')
    .select('id, slug, full_name, email, user_id, coach_id').eq('slug', slug).maybeSingle()
  if (error) throw new Error(`clients(${slug}): ${error.message}`)
  return data
}
async function getAuthEmailById(sb, id) {
  if (!id) return null
  const { data, error } = await sb.auth.admin.getUserById(id)
  if (error) return null
  return data?.user?.email || null
}
function loadMappingFile() {
  const file = process.env.CLIENT_USER_MAP || path.join(__dirname, 'client-user-map.local.json')
  if (!fs.existsSync(file)) exit(`--mapping pedido pero no existe ${path.relative(ROOT, file)}`)
  const arr = JSON.parse(fs.readFileSync(file, 'utf8'))
  const m = {}
  for (const e of arr) if (e.slug && e.email && !/EMAIL_DE_|@ejemplo|@example/i.test(e.email)) m[e.slug] = e.email
  return m
}

// ── Escritura segura de un match 'link' ───────────────────────────────────────
async function applyLink(sb, target, client, user, errors) {
  // colisión: ese auth user ya vinculado a OTRO client
  const { data: others } = await sb.from('clients').select('slug, full_name').eq('user_id', user.id).neq('slug', target.slug).limit(1)
  if (others?.length) {
    errors.push({ slug: target.slug, step: 'conflict.user', message: `auth user ya vinculado a slug='${others[0].slug}'` })
    console.log(`  ✗ ese auth user ya está vinculado a slug='${others[0].slug}'`); return
  }
  // colisión: client.user_id ya seteado a otro
  if (client.user_id && client.user_id !== user.id && !FORCE) {
    errors.push({ slug: target.slug, step: 'conflict.client', message: 'user_id ya apunta a otro usuario (usá --force)' })
    console.log(`  ✗ client ya tiene user_id=${shortId(client.user_id)} (distinto). No se pisa sin --force.`); return
  }
  // profile (id = auth.users.id, role='client')
  const { data: prof, error: pErr } = await sb.from('profiles').select('id, role').eq('id', user.id).maybeSingle()
  if (pErr) { errors.push({ slug: target.slug, step: 'profiles.select', message: pErr.message }); console.log('  ✗ profiles:', pErr.message); return }
  if (!prof) {
    const { error } = await sb.from('profiles').insert({ id: user.id, full_name: client.full_name, role: 'client' })
    if (error) { errors.push({ slug: target.slug, step: 'profiles.insert', message: error.message }); console.log('  ✗ insert profile:', error.message); return }
    console.log('  · profile creado (role=client)')
  } else if (prof.role === 'coach') {
    errors.push({ slug: target.slug, step: 'profiles.role', message: "profile es 'coach' — conflicto" })
    console.log("  ✗ ese profile es role='coach' — no se degrada."); return
  } else if (prof.role !== 'client') {
    const { error } = await sb.from('profiles').update({ role: 'client' }).eq('id', user.id)
    if (error) { errors.push({ slug: target.slug, step: 'profiles.update', message: error.message }); console.log('  ✗ update role:', error.message); return }
    console.log(`  · profile role ${prof.role}→client`)
  }
  // clients.user_id (+ email si null)
  const updates = {}
  if (client.user_id !== user.id) updates.user_id = user.id
  if (!client.email) updates.email = user.email
  if (!Object.keys(updates).length) { console.log('  ✓ ya vinculado (sin cambios)'); return }
  const { error } = await sb.from('clients').update(updates).eq('id', client.id)
  if (error) { errors.push({ slug: target.slug, step: 'clients.update', message: error.message }); console.log('  ✗ update clients:', error.message); return }
  console.log(`  ✓ vinculado → user_id=${shortId(user.id)}${updates.email ? ' (+email)' : ''}`)
}

function printResolution(target, client, res) {
  console.log(`\nslug: ${target.slug}`)
  console.log(`client: ${client ? client.full_name : '(no existe)'}`)
  if (res.decision === 'notfound') {
    console.log('auth match: no encontrado')
    console.log('acción: requiere revisión — no hay candidatos (no se inventa)')
  } else if (res.decision === 'ambiguous') {
    console.log('auth match: AMBIGUO (más de un candidato)')
    res.candidates.slice(0, 5).forEach((c) => console.log(`   candidato: ${c.email}  (score ${c.score})`))
    console.log('acción: requiere revisión — NO se vincula')
  } else if (res.decision === 'review') {
    console.log(`auth match: ${res.candidates[0].email}  (score ${res.candidates[0].score})`)
    console.log(`confidence: ${res.confidence}`)
    console.log('acción: requiere revisión — confianza no suficiente para auto-vincular')
  } else {
    console.log(`auth match: ${res.chosen.email}`)
    console.log(`confidence: ${res.confidence}`)
    console.log('acción: vincularía user_id')
  }
}

// ── Verificación read-only ────────────────────────────────────────────────────
async function verifyOne(sb, target) {
  console.log(`\n── ${target.slug} ──`)
  const client = await getClientBySlug(sb, target.slug)
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

// Marca colisiones cruzadas: dos clientes que resuelven al MISMO auth user.
function flagCollisions(results) {
  const byUser = {}
  for (const r of results) if (r.res.decision === 'link') (byUser[r.res.chosen.id] ||= []).push(r)
  for (const list of Object.values(byUser)) {
    if (list.length > 1) for (const r of list) {
      r.res.decision = 'ambiguous'
      r.res.candidates = list.map((x) => ({ email: x.res.chosen.email, id: x.res.chosen.id, score: 999 }))
    }
  }
}

// ── Self-test OFFLINE (sin DB, sin key) — valida la heurística ────────────────
function selftest() {
  console.log('\n=== SELF-TEST de la heurística (OFFLINE, sin DB) ===')
  const fakeUsers = [
    { id: 'u-eze',   email: 'ezequiel@asesorados.local' },
    { id: 'u-tomi',  email: 'tomiasesorado@asesorados.local' },
    { id: 'u-mateo', email: 'mateo@asesorados.local' },
    { id: 'u-coach', email: 'tomassanchez2018@gmail.com' },
    { id: 'u-noise', email: 'info@asesorados.local' },
    // a propósito SIN giselle → debe reportar "no encontrado"
  ]
  const fakeNames = { eze: 'Ezequiel Huenqueo', giselle: 'Brenda Giselle Ninancoro', tomi: 'Tomás Villegas', mateo: 'Mateo Braghero' }
  // Igual que en vivo: los coaches se EXCLUYEN del pool (acá u-coach simula a Tomás Sánchez).
  const coachIds = new Set(['u-coach'])
  const pool = fakeUsers.filter((u) => !coachIds.has(u.id))
  const results = TARGETS.map((t) => ({ target: t, client: { full_name: fakeNames[t.slug] }, res: resolveClient(t, fakeNames[t.slug], pool, null) }))
  flagCollisions(results)
  for (const r of results) printResolution(r.target, r.client, r.res)
  const expect = { eze: 'link', tomi: 'link', mateo: 'link', giselle: 'notfound' }
  const ok = results.every((r) => r.res.decision === expect[r.target.slug])
  console.log(`\n${ok ? '✓' : '✗'} Resultado self-test: ${ok ? 'OK (eze/tomi/mateo=link, giselle=notfound)' : 'DISTINTO al esperado — revisar heurística'}\n`)
  process.exit(ok ? 0 : 1)
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (SELFTEST) return selftest()

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
    console.log('\n=== Vínculos auth ↔ clients  [VERIFY · solo lectura] ===')
    for (const t of TARGETS) await verifyOne(sb, t)
    console.log('')
    return
  }

  const mapping = USE_MAPPING ? loadMappingFile() : {}
  const users = await loadAllAuthUsers(sb)

  // EXCLUIR coaches del pool de candidatos: un login de asesorado nunca debe
  // resolver a la cuenta del coach (caso real: coach Tomás vs asesorado Tomás Villegas).
  const { data: coachProfiles } = await sb.from('profiles').select('id').eq('role', 'coach')
  const excludeIds = new Set((coachProfiles || []).map((p) => p.id))
  const pool = users.filter((u) => !excludeIds.has(u.id))

  console.log(`\n=== Auto-vincular auth ↔ clients  [${APPLY ? 'APPLY' : 'DRY-RUN'}${USE_MAPPING ? ' · mapping' : ' · auto'}] ===`)
  console.log(`(auth.users: ${users.length} · coaches excluidos: ${excludeIds.size} · pool candidato: ${pool.length})`)

  // Resolver todos
  const results = []
  for (const target of TARGETS) {
    const client = await getClientBySlug(sb, target.slug)
    if (!client) { results.push({ target, client: null, res: { decision: 'notfound', confidence: '-', chosen: null, candidates: [] } }); continue }
    if (client.full_name !== target.expected) {
      results.push({ target, client, res: { decision: 'review', confidence: 'nombre', chosen: null, candidates: [], nameMismatch: true } })
      continue
    }
    results.push({ target, client, res: resolveClient(target, client.full_name, pool, mapping[target.slug]) })
  }
  flagCollisions(results)

  // Mostrar plan
  for (const r of results) {
    if (r.res.nameMismatch) {
      console.log(`\nslug: ${r.target.slug}`)
      console.log(`client: ${r.client.full_name}`)
      console.log(`acción: BLOQUEADO — full_name ≠ esperado ("${r.target.expected}"). Corregí antes de vincular.`)
    } else {
      printResolution(r.target, r.client, r.res)
    }
  }

  const linkable = results.filter((r) => r.res.decision === 'link' && r.client)
  const skipped = results.filter((r) => r.res.decision !== 'link')

  if (!APPLY) {
    console.log(`\n— Resumen dry-run —`)
    console.log(`  vincularía: ${linkable.map((r) => r.target.slug).join(', ') || '—'}`)
    console.log(`  pendientes: ${skipped.map((r) => `${r.target.slug}(${r.res.nameMismatch ? 'nombre' : r.res.decision})`).join(', ') || '—'}`)
    console.log('\n✓ DRY-RUN OK: no se escribió nada. Reejecutá con --apply para vincular los matches seguros.\n')
    return
  }

  // APPLY: solo los 'link'
  const errors = []
  for (const r of linkable) {
    console.log(`\n▶ ${r.target.slug} → ${r.res.chosen.email}`)
    await applyLink(sb, r.target, r.client, r.res.chosen, errors)
  }
  console.log('\n— Resumen apply —')
  console.log(`  vinculados (intentados): ${linkable.map((r) => r.target.slug).join(', ') || '—'}`)
  console.log(`  omitidos: ${skipped.map((r) => `${r.target.slug}(${r.res.nameMismatch ? 'nombre' : r.res.decision})`).join(', ') || '—'}`)
  if (errors.length) {
    console.error('\n✗ APPLY con errores/conflictos:')
    for (const e of errors) console.error(`   - ${e.slug} · ${e.step}: ${e.message}`)
    console.error('')
    process.exit(1)
  }
  console.log('\n✓ APPLY OK — matches seguros vinculados sin errores.\n')
}

main().catch((e) => exit(e.message))
