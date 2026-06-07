// =============================================================================
// audit-client-data.mjs — Auditoría READ-ONLY de todos los asesorados.
//
// Verifica de un vistazo el estado de cada client sin entrar perfil por perfil:
// nutrición, macros, comidas (simple/semanal/texto/vacío), peso, fotos, vínculo
// de usuario y plan duplicado. NO modifica nada. NO toca Auth. NUNCA imprime la
// service_role key ni contraseñas.
//
// USO (PowerShell):
//   $env:SUPABASE_SERVICE_ROLE_KEY='<service-role-key>'; node scripts/audit-client-data.mjs
//   (SUPABASE_URL opcional si ya está VITE_SUPABASE_URL en .env.local)
//
// SALIDA: tabla en consola + reporte Markdown en reports/client-data-audit.md
// La service_role key se usa solo para sortear RLS en lectura; nunca se escribe.
// =============================================================================
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { normalizeMealPlan } from '../src/lib/mealPlan.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const SUSPECT_MIN = 35 // kg
const SUSPECT_MAX = 180 // kg

function readEnvLocal(name) {
  try {
    const env = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
    const m = env.match(new RegExp('^' + name + '=(.*)$', 'm'))
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : null
  } catch { return null }
}

const url = process.env.SUPABASE_URL || readEnvLocal('VITE_SUPABASE_URL')
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('\n✗ Faltan variables de entorno (solo lectura; el valor nunca se imprime):')
  if (!url) console.error('   - SUPABASE_URL (o VITE_SUPABASE_URL en .env.local)')
  if (!key) console.error('   - SUPABASE_SERVICE_ROLE_KEY (del entorno; necesaria para leer todos los asesorados sorteando RLS)')
  console.error("\n   PowerShell:  $env:SUPABASE_SERVICE_ROLE_KEY='<service-role-key>'; node scripts/audit-client-data.mjs\n")
  process.exit(1)
}

const sb = createClient(url, key, { auth: { persistSession: false } })

function groupBy(arr, k) {
  const m = new Map()
  for (const x of arr) { if (!m.has(x[k])) m.set(x[k], []); m.get(x[k]).push(x) }
  return m
}

function auditClient(c, idx) {
  const activePlans = (idx.plans.get(c.id) || []).filter((p) => p.active)
  const plan = activePlans[0] || null
  const mp = normalizeMealPlan(plan ? { meals: plan.meals } : null)
  const optionCount = mp.schemes.reduce((s, sc) => s + sc.meals.reduce((a, m) => a + m.options.length, 0), 0)
  const macrosComplete = !!plan && plan.protein != null && plan.carbs != null && plan.fats != null

  const withWeight = (idx.metrics.get(c.id) || [])
    .filter((m) => m.weight != null)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  const lastWeight = withWeight.length ? Number(withWeight[0].weight) : null
  const suspect = lastWeight != null && (lastWeight < SUSPECT_MIN || lastWeight > SUSPECT_MAX)

  const photos = idx.photos.get(c.id) || []
  const lastPhoto = photos.length
    ? photos.map((p) => p.created_at).sort().at(-1)
    : null

  const hasUser = !!c.user_id
  const role = hasUser ? (idx.roles.get(c.user_id) || null) : null
  const activeWorkout = (idx.workouts.get(c.id) || []).some((w) => w.active)

  // ── Estado: lista de problemas reales (vacío = OK) ──────────────────────────
  const issues = []
  if (activePlans.length === 0) issues.push('FALTA NUTRICIÓN')
  else {
    if (activePlans.length > 1) issues.push('PLAN DUPLICADO')
    if (!macrosComplete) issues.push('FALTA MACROS')
    if (mp.type === 'empty') issues.push('FALTA COMIDAS')
  }
  if (!hasUser) issues.push('SIN USER_ID')
  else if (!role) issues.push('SIN PROFILE')
  if (suspect) issues.push('PESO SOSPECHOSO')
  // Nota: "sin fotos" NO es un problema (puede ser normal).

  const tipo = mp.type === 'empty' ? 'vacío'
    : mp.type === 'plain' ? 'texto'
    : mp.weekly ? 'semanal'
    : mp.type === 'grouped' ? 'esquemas'
    : 'simple'
  const comidas = mp.type === 'empty' ? '—'
    : mp.type === 'plain' ? 'texto'
    : mp.type === 'grouped' ? `${tipo} · ${mp.schemes.length} esq · ${optionCount} opc`
    : `${optionCount} opc`

  return {
    slug: c.slug,
    nombre: c.full_name,
    status: c.status,
    email: c.email || '—',
    user: hasUser ? 'OK' : '—',
    role: role || '—',
    activePlans: activePlans.length,
    plan: activePlans.length === 0 ? 'FALTA' : activePlans.length > 1 ? `DUP(${activePlans.length})` : 'OK',
    kcal: plan?.calories ?? '—',
    pcg: plan ? (macrosComplete ? `${plan.protein}/${plan.carbs}/${plan.fats}` : 'FALTAN') : '—',
    tipo,
    comidas,
    peso: lastWeight == null ? '—' : (suspect ? `⚠ ${lastWeight}` : `${lastWeight}`),
    registrosPeso: withWeight.length,
    fotos: photos.length,
    ultimaFoto: lastPhoto ? String(lastPhoto).slice(0, 10) : '—',
    workout: activeWorkout ? 'OK' : '—',
    estado: issues.length ? issues.join(' · ') : 'OK',
    issues,
  }
}

function buildMarkdown(rows) {
  const ok = rows.filter((r) => r.estado === 'OK')
  const warn = rows.filter((r) => r.estado !== 'OK')
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ')
  const esc = (s) => String(s).replace(/\|/g, '\\|')

  let md = `# Auditoría de datos de asesorados\n\n`
  md += `_Generado: ${now} · solo lectura, no se modificó nada._\n\n`
  md += `**${rows.length} asesorados** · ✅ OK: ${ok.length} · ⚠️ con advertencias: ${warn.length}\n\n`
  md += `| slug | nombre | user | plan | kcal | P/C/G | comidas | peso | reg. | fotos | últ. foto | workout | estado |\n`
  md += `|---|---|---|---|---|---|---|---|---|---|---|---|---|\n`
  for (const r of rows) {
    md += `| ${esc(r.slug)} | ${esc(r.nombre)} | ${r.user} | ${r.plan} | ${r.kcal} | ${r.pcg} | ${esc(r.comidas)} | ${r.peso} | ${r.registrosPeso} | ${r.fotos} | ${r.ultimaFoto} | ${r.workout} | ${esc(r.estado)} |\n`
  }

  if (warn.length) {
    md += `\n## Advertencias\n\n`
    for (const r of warn) {
      const finished = r.status === 'finished' ? ' _(asesorado finalizado / posible duplicado)_' : ''
      md += `- **${esc(r.slug)}** (${esc(r.nombre)}): ${esc(r.estado)}${finished}\n`
    }
  } else {
    md += `\n_Sin advertencias._\n`
  }
  md += `\n> "Sin fotos" no se considera error (puede ser normal). "Sin workout activo" tampoco.\n`
  return md
}

async function main() {
  const queries = {
    clients: sb.from('clients').select('id, slug, full_name, email, user_id, status').order('slug'),
    profiles: sb.from('profiles').select('id, role'),
    plans: sb.from('nutrition_plans').select('client_id, active, calories, protein, carbs, fats, meals'),
    workouts: sb.from('workout_plans').select('client_id, active'),
    metrics: sb.from('progress_metrics').select('client_id, weight, created_at'),
    photos: sb.from('checkin_photos').select('client_id, created_at'),
  }
  const entries = Object.entries(queries)
  const results = await Promise.all(entries.map(([, q]) => q))
  const data = {}
  results.forEach((res, i) => {
    const name = entries[i][0]
    if (res.error) { console.error(`✗ Error leyendo ${name}: ${res.error.message}`); process.exit(1) }
    data[name] = res.data || []
  })

  const idx = {
    roles: new Map(data.profiles.map((p) => [p.id, p.role])),
    plans: groupBy(data.plans, 'client_id'),
    workouts: groupBy(data.workouts, 'client_id'),
    metrics: groupBy(data.metrics, 'client_id'),
    photos: groupBy(data.photos, 'client_id'),
  }

  const rows = data.clients.map((c) => auditClient(c, idx))

  console.log('\n=== Auditoría de asesorados (READ-ONLY) ===')
  console.table(rows.map((r) => ({
    slug: r.slug, nombre: r.nombre, user: r.user, plan: r.plan, kcal: r.kcal,
    'P/C/G': r.pcg, comidas: r.comidas, peso: r.peso, fotos: r.fotos, estado: r.estado,
  })))

  const out = path.join(ROOT, 'reports', 'client-data-audit.md')
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, buildMarkdown(rows))
  console.log(`\n✓ Reporte: ${path.relative(ROOT, out)} · ${rows.length} asesorados · no se modificó ningún dato.\n`)
}

main().catch((e) => { console.error('\n✗ Error en la auditoría:', e.message, '\n'); process.exit(1) })
