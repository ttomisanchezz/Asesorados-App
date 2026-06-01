// =============================================================================
// import-clients.mjs  —  Importa perfil + nutrición + rutina de un asesorado.
//
// SEGURIDAD / REGLAS:
//   - DRY-RUN por defecto. Solo escribe con --apply.
//   - service_role key SOLO desde env SUPABASE_SERVICE_ROLE_KEY (nunca de archivos).
//   - Idempotente: no duplica. clients por slug; nutrition/workout por "plan activo".
//   - NO toca a Lu (perfil modelo). NO inventa datos: lo que falta queda vacío.
//   - reps corruptas (fechas Excel) → null, igual que el perfil de Lu.
//
// USO (PowerShell):
//   $env:SUPABASE_SERVICE_ROLE_KEY="..."; node scripts/import-clients.mjs eze            # dry-run
//   $env:SUPABASE_SERVICE_ROLE_KEY="..."; node scripts/import-clients.mjs eze --apply     # escribe
//   $env:SUPABASE_SERVICE_ROLE_KEY="..."; node scripts/import-clients.mjs eze --verify    # solo lectura
//   node scripts/import-clients.mjs            # dry-run de TODOS (menos lu)
//   node scripts/import-clients.mjs eze --parse-only   # sin DB, valida la extracción
//   node scripts/import-clients.mjs mateo --apply --update-profile   # sobrescribe perfil ya cargado
//
// FLAGS:
//   --apply           escribe en la DB (por defecto: dry-run)
//   --verify          solo lectura, resumen compacto
//   --parse-only      sin DB, solo valida la extracción de los archivos
//   --update-profile  en clientes EXISTENTES, sobrescribe full_name/objective/age/weight/height
//                     con lo parseado (sin la flag solo rellena gaps; nunca pisa datos cargados)
//
// COACH (clients.coach_id → public.profiles.id → auth.users.id):
//   $env:COACH_EMAIL="coach@dominio.com"   # recomendado: resuelve y valida el profile
//   $env:COACH_ID="<uuid de public.profiles>"   # solo si ya conocés el id del profile
//
// SALIDA: exit 0 si todo OK; exit 1 si falla cualquier escritura en --apply.
// NUNCA imprime la service_role key ni pide pegarla en ningún lado.
// =============================================================================

import fs from 'node:fs'
import zlib from 'node:zlib'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const IMPORTS = path.join(ROOT, 'imports')
const APPLY = process.argv.includes('--apply')
const PARSE_ONLY = process.argv.includes('--parse-only')
const VERIFY = process.argv.includes('--verify')
// Por defecto, en clientes EXISTENTES solo se rellenan gaps (nunca pisa datos).
// Con --update-profile se autoriza explícitamente sobrescribir full_name/objective/age/weight/height.
const UPDATE_PROFILE = process.argv.includes('--update-profile')
const argClient = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null

// Registro de asesorados. lu queda EXCLUIDA a propósito (perfil modelo).
const CLIENTS = {
  eze:     { slug: 'eze',     fallbackName: 'Ezequiel Huenqueo' },
  giselle: { slug: 'giselle', fallbackName: 'Brenda Giselle Ninancoro' },
  mateo:   { slug: 'mateo',   fallbackName: 'Mateo Braghero' },
  ro:      { slug: 'ro',      fallbackName: 'Ro', needsRealName: true },
  santi:   { slug: 'santi',   fallbackName: 'Santiago' },
  tomi:    { slug: 'tomi',    fallbackName: 'Tomás Villegas' },
}

// ── ZIP / XLSX / DOCX readers (reusa el patrón de import-lu-progress) ─────────
function listZipEntries(buf) {
  let eocd = -1
  for (let i = buf.length - 22; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  if (eocd < 0) throw new Error('ZIP inválido')
  const entries = buf.readUInt16LE(eocd + 10)
  let off = buf.readUInt32LE(eocd + 16)
  const names = []
  for (let e = 0; e < entries; e++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break
    const nameLen = buf.readUInt16LE(off + 28)
    const extraLen = buf.readUInt16LE(off + 30)
    const commentLen = buf.readUInt16LE(off + 32)
    names.push(buf.toString('utf8', off + 46, off + 46 + nameLen))
    off += 46 + nameLen + extraLen + commentLen
  }
  return names
}
function readZipEntry(buf, wantName) {
  let eocd = -1
  for (let i = buf.length - 22; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  if (eocd < 0) throw new Error('ZIP inválido')
  const entries = buf.readUInt16LE(eocd + 10)
  let off = buf.readUInt32LE(eocd + 16)
  for (let e = 0; e < entries; e++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break
    const method = buf.readUInt16LE(off + 10)
    const compSize = buf.readUInt32LE(off + 20)
    const nameLen = buf.readUInt16LE(off + 28)
    const extraLen = buf.readUInt16LE(off + 30)
    const commentLen = buf.readUInt16LE(off + 32)
    const localOff = buf.readUInt32LE(off + 42)
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen)
    if (name === wantName) {
      const lnNameLen = buf.readUInt16LE(localOff + 26)
      const lnExtraLen = buf.readUInt16LE(localOff + 28)
      const dataStart = localOff + 30 + lnNameLen + lnExtraLen
      const comp = buf.subarray(dataStart, dataStart + compSize)
      return method === 8 ? zlib.inflateRawSync(comp) : Buffer.from(comp)
    }
    off += 46 + nameLen + extraLen + commentLen
  }
  return null
}
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
const colL = (r) => r.replace(/[0-9]+/g, '')
const rowN = (r) => parseInt(r.replace(/[A-Z]+/g, ''), 10)

function readFirstSheet(buf) {
  const ssXml = readZipEntry(buf, 'xl/sharedStrings.xml')
  const strings = ssXml
    ? [...ssXml.toString('utf8').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
        [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => decode(x[1])).join(''))
    : []
  const sheetNames = listZipEntries(buf).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort()
  if (!sheetNames.length) return {}
  const sheet = readZipEntry(buf, sheetNames[0]).toString('utf8')
  const cRe = /<c r="([A-Z]+[0-9]+)"(?:[^>]*?t="([^"]*)")?[^>]*>(?:<v>([\s\S]*?)<\/v>|<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>)?<\/c>/g
  const rows = {}
  let c
  while ((c = cRe.exec(sheet))) {
    const ref = c[1], t = c[2]
    let val = c[3] !== undefined ? c[3] : c[4] !== undefined ? c[4] : ''
    if (t === 's') val = strings[parseInt(val, 10)]
    if (val !== '' && val !== undefined) (rows[rowN(ref)] = rows[rowN(ref)] || {})[colL(ref)] = decode(String(val))
  }
  return rows
}
function readDocxParagraphs(buf) {
  const docXml = readZipEntry(buf, 'word/document.xml')
  if (!docXml) return []
  const xml = docXml.toString('utf8')
  return [...xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)]
    .map((m) => [...m[0].matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((x) => decode(x[1])).join(''))
    .map((p) => p.trim()).filter(Boolean)
}

// ── Parseo de perfil + macros desde el docx ──────────────────────────────────
function pairValue(paras, label) {
  const L = label.toLowerCase()
  for (let i = 0; i < paras.length - 1; i++) if (paras[i].toLowerCase().trim() === L) return paras[i + 1].trim()
  return null
}
function firstInt(s) { const m = String(s ?? '').match(/-?\d+/); return m ? parseInt(m[0], 10) : null }
function firstFloat(s) { const m = String(s ?? '').replace(',', '.').match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null }

function parseProfile(paras) {
  if (!paras.length) return {}
  const name = pairValue(paras, 'Nombre completo')
  const age = firstInt(pairValue(paras, 'Edad'))
  const weight = firstFloat(pairValue(paras, 'Peso actual'))
  let height = firstFloat(pairValue(paras, 'Altura'))
  if (height != null && height < 3) height = Math.round(height * 100) // m → cm
  const objectiveMain = pairValue(paras, 'Objetivo principal')
  const objectiveSec = pairValue(paras, 'Objetivo secundario') || pairValue(paras, 'Objetivos específicos')
  // kcal: del encabezado (párrafo 2) "Nombre | 2200 kcal | ..." o de labels.
  let kcal = null
  const header = paras[1] || ''
  const kRange = header.match(/(\d{3,4})\s*[–-]\s*(\d{3,4})\s*kcal/i)
  const kSingle = header.match(/(\d{3,4})\s*kcal/i)
  if (kRange) kcal = Math.round((+kRange[1] + +kRange[2]) / 2)
  else if (kSingle) kcal = +kSingle[1]
  else kcal = firstInt(pairValue(paras, 'Calorías iniciales del plan') || pairValue(paras, 'Calorías totales promedio'))
  // macros — solo se aceptan si caen en un rango fisiológico plausible.
  // Si no, queda null (NO se inventa): muchos docx tienen el macro como fórmula
  // ("1,8 g x kg") y el pairing devolvería un 1 o un 0 sin sentido.
  const sane = (v, min, max) => (v != null && v >= min && v <= max ? v : null)
  const protein = sane(firstInt(pairValue(paras, 'Proteínas') || pairValue(paras, 'Proteinas')), 30, 400)
  const fats = sane(firstInt(pairValue(paras, 'Grasas')), 15, 250)
  const carbs = sane(firstInt(pairValue(paras, 'Carbohidratos') || pairValue(paras, 'Carbos') || pairValue(paras, 'Hidratos de carbono')), 30, 800)
  return { name, age, weight, height, objectiveMain, objectiveSec, kcal, protein, fats, carbs }
}

// ── Parseo de rutina (dos templates) ─────────────────────────────────────────
const cleanNum = (v) => (v == null ? '' : String(v).replace(/\.0+$/, '').trim())
const isCleanReps = (v) => {
  const s = cleanNum(v)
  return /^\d{1,2}\s*[-–]\s*\d{1,2}$/.test(s) || /^\d{1,2}$/.test(s)
}

function detectTemplate(rows) {
  for (const r of Object.keys(rows).map(Number)) {
    const row = rows[r]
    const A = String(row.A ?? '').toUpperCase().trim()
    const B = String(row.B ?? '').toUpperCase().trim()
    if (A === 'DIA' && B.includes('MUSCULO')) return 'vertical'
    if (A === 'N°' && B.includes('EJERCICIO')) return 'horizontal'
  }
  return null
}

function buildExercise({ name, sets, rir, reps, notes }, stats) {
  const repsClean = isCleanReps(reps) ? cleanNum(reps) : null
  if (reps != null && cleanNum(reps) !== '' && repsClean == null) stats.repsDropped++
  return {
    name: String(name).trim(),
    sets: cleanNum(sets) || null,
    rir: cleanNum(rir) || null,
    reps: repsClean,
    notes: notes ? String(notes).trim() : null,
    videoUrl: null, // la columna VIDEO trae un rótulo, no una URL → no se inventa
  }
}

function parseVertical(rows, stats) {
  const days = []
  let cur = null
  for (const r of Object.keys(rows).map(Number).sort((a, b) => a - b)) {
    const row = rows[r]
    const A = String(row.A ?? '').trim()
    if (/^DIA\b/i.test(A) && !/MUSCULO/i.test(String(row.B ?? ''))) {
      cur = { day: `Día ${days.length + 1}`, focus: (row.B ? String(row.B) : A).trim(), exercises: [] }
      days.push(cur)
      if (row.C) cur.exercises.push(buildExercise({ name: row.C, sets: row.E, rir: row.F, reps: row.G, notes: row.D || row.J }, stats))
    } else if (cur && row.C && !/EJERCIO/i.test(String(row.C))) {
      cur.exercises.push(buildExercise({ name: row.C, sets: row.E, rir: row.F, reps: row.G, notes: row.D || row.J }, stats))
    }
  }
  return days
}

function parseHorizontal(rows, stats) {
  const days = []
  let cur = null
  for (const r of Object.keys(rows).map(Number).sort((a, b) => a - b)) {
    const row = rows[r]
    const A = String(row.A ?? '').trim()
    if (/^DIA\s*\d/i.test(A) && !row.B) {
      const focus = A.includes('·') ? A.split('·').slice(1).join('·').trim() : A
      cur = { day: `Día ${days.length + 1}`, focus, exercises: [] }
      days.push(cur)
      continue
    }
    if (!cur) continue
    if (/ejercicio/i.test(String(row.B ?? ''))) continue // fila de cabecera de columnas
    const name = String(row.B ?? '').trim()
    if (!name) continue
    cur.exercises.push(buildExercise({ name, sets: row.E, rir: row.G, reps: row.F, notes: row.D }, stats))
  }
  return days
}

function parseRoutine(buf) {
  const rows = readFirstSheet(buf)
  const tpl = detectTemplate(rows)
  if (!tpl) return null
  const stats = { repsDropped: 0 }
  const days = (tpl === 'vertical' ? parseVertical : parseHorizontal)(rows, stats)
    .filter((d) => d.exercises.length > 0)
  return { template: tpl, days, stats }
}

// ── Avatar (cosmético, no es dato de fitness) ────────────────────────────────
const PALETTE = ['#6c63ff', '#22c55e', '#f59e0b', '#ec4899', '#0ea5e9', '#a855f7', '#ef4444']
function initialsOf(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
}
function colorOf(slug) {
  let h = 0; for (const c of slug) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]
}

// ── Carga de un cliente ──────────────────────────────────────────────────────
async function processClient(sb, key, coachId, errors) {
  const cfg = CLIENTS[key]
  const dir = path.join(IMPORTS, key)
  const files = fs.existsSync(dir) ? fs.readdirSync(dir) : []
  const docxFile = files.find((f) => f.toLowerCase().endsWith('.docx'))
  const xlsxRoutine = files.find((f) => /rutina/i.test(f) && f.toLowerCase().endsWith('.xlsx'))

  console.log(`\n${'─'.repeat(64)}\n▶ ${key}  (archivos: ${files.join(', ') || 'ninguno'})`)

  // 1) Perfil desde docx
  const profile = docxFile ? parseProfile(readDocxParagraphs(fs.readFileSync(path.join(dir, docxFile)))) : {}
  const fullName = profile.name || cfg.fallbackName
  const objective = profile.objectiveMain || null
  if (cfg.needsRealName) console.log('  ⚠ NOMBRE placeholder (no hay docx con nombre real) — confirmá el nombre de este asesorado.')
  if (!objective) console.log('  ⚠ Sin objetivo (no hay dato real) — queda vacío.')

  console.log('  Perfil:', JSON.stringify({
    fullName, age: profile.age ?? null, weight: profile.weight ?? null,
    height: profile.height ?? null, objective,
  }))

  // 2) Rutina desde xlsx
  let routine = null
  if (xlsxRoutine) {
    routine = parseRoutine(fs.readFileSync(path.join(dir, xlsxRoutine)))
    if (routine) {
      const totalEx = routine.days.reduce((s, d) => s + d.exercises.length, 0)
      console.log(`  Rutina: template=${routine.template}  ${routine.days.length} días, ${totalEx} ejercicios` +
        (routine.stats.repsDropped ? `  (reps corruptas descartadas: ${routine.stats.repsDropped} → null)` : ''))
      routine.days.forEach((d) => console.log(`     · ${d.day} — ${d.focus}: ${d.exercises.length} ejercicios`))
    } else console.log('  ⚠ rutina.xlsx no coincide con ningún template conocido — se omite.')
  } else {
    console.log('  ⚠ Sin rutina.xlsx — workout_plan queda vacío.')
  }

  // 3) Nutrición
  const hasNutrition = profile.kcal != null || profile.protein != null
  if (hasNutrition) {
    console.log('  Nutrición:', JSON.stringify({
      kcal: profile.kcal ?? null, protein: profile.protein ?? null,
      carbs: profile.carbs ?? null, fats: profile.fats ?? null,
    }))
  } else if (docxFile) {
    console.log('  ⚠ No se pudo extraer kcal/macros limpios del docx — nutrition_plan queda vacío.')
  }

  // En modo parse-only no se toca la DB: solo se muestra lo extraído.
  if (PARSE_ONLY) {
    if (routine?.days.length) {
      const first = routine.days[0].exercises[0]
      console.log('  Ejemplo de ejercicio parseado:', JSON.stringify(first))
    }
    return
  }

  // ── Acciones sobre la DB ───────────────────────────────────────────────────
  // 1) clients (upsert por slug; rellena solo gaps; nunca pisa datos existentes)
  const { data: existing } = await sb.from('clients').select('*').eq('slug', cfg.slug).maybeSingle()
  let clientId = existing?.id ?? null

  const clientFields = {
    objective: objective ?? undefined,
    age: profile.age ?? undefined,
    weight: profile.weight ?? undefined,
    height: profile.height ?? undefined,
  }

  if (existing) {
    if (UPDATE_PROFILE) {
      // Modo explícito: sobrescribe campos de perfil con lo PARSEADO (solo si hay dato real).
      // full_name nunca se pisa con un placeholder/fallback: requiere nombre real del docx.
      const candidates = {
        full_name: profile.name || undefined,
        objective: objective ?? undefined,
        age: profile.age ?? undefined,
        weight: profile.weight ?? undefined,
        height: profile.height ?? undefined,
      }
      const updates = {}
      for (const [k, v] of Object.entries(candidates)) {
        if (v !== undefined && v !== null && v !== '' && String(existing[k]) !== String(v)) updates[k] = v
      }
      console.log(`  DB clients: EXISTE (id=${String(clientId).slice(0, 8)}…) · --update-profile · sobrescribe: ${Object.keys(updates).length ? JSON.stringify(updates) : '— (ya coincide, sin cambios)'}`)
      if (APPLY && Object.keys(updates).length) {
        const { error } = await sb.from('clients').update(updates).eq('id', clientId)
        if (error) {
          console.log('    ✗ error update clients:', error.message)
          errors.push({ client: key, step: 'clients.update', message: error.message })
        }
      }
    } else {
      const gaps = {}
      for (const [k, v] of Object.entries(clientFields)) if (v !== undefined && (existing[k] == null || existing[k] === '')) gaps[k] = v
      console.log(`  DB clients: EXISTE (id=${String(clientId).slice(0, 8)}…). Rellenar gaps: ${Object.keys(gaps).length ? JSON.stringify(gaps) : '—'}` +
        (Object.values(clientFields).some((v) => v !== undefined) ? '  (usá --update-profile para sobrescribir datos ya cargados)' : ''))
      if (APPLY && Object.keys(gaps).length) {
        const { error } = await sb.from('clients').update(gaps).eq('id', clientId)
        if (error) {
          console.log('    ✗ error update clients:', error.message)
          errors.push({ client: key, step: 'clients.update', message: error.message })
        }
      }
    }
  } else {
    const payload = {
      coach_id: coachId, slug: cfg.slug, full_name: fullName,
      objective: objective, age: profile.age ?? null,
      weight: profile.weight ?? null, height: profile.height ?? null,
      status: 'active', avatar_initials: initialsOf(fullName), avatar_color: colorOf(cfg.slug),
    }
    console.log('  DB clients: CREAR →', JSON.stringify({ slug: payload.slug, full_name: payload.full_name }))
    if (APPLY) {
      const { data, error } = await sb.from('clients').insert(payload).select('id').single()
      if (error) {
        console.log('    ✗ error insert clients:', error.message)
        errors.push({ client: key, step: 'clients.insert', message: error.message })
        console.log('    ↳ No se crea nutrición ni rutina para este cliente (falló la creación del client).')
        return
      }
      clientId = data.id
    }
  }

  if (!clientId && !APPLY) clientId = '(se crea al aplicar)'

  // 2) nutrition_plans (no duplicar: si ya hay plan activo, omitir)
  if (hasNutrition && clientId && clientId !== '(se crea al aplicar)') {
    const { data: np } = await sb.from('nutrition_plans').select('id').eq('client_id', clientId).eq('active', true).limit(1)
    if (np?.length) {
      console.log('  DB nutrition_plans: ya tiene plan activo → se omite (no duplica).')
    } else {
      const notes = [objective ? `Objetivo: ${objective}` : null, profile.objectiveSec ? `Secundario: ${profile.objectiveSec}` : null,
        'Plan base importado (kcal + macros). Comidas detalladas pendientes.'].filter(Boolean).join(' · ')
      console.log('  DB nutrition_plans: CREAR (kcal+macros).')
      if (APPLY) {
        const { error } = await sb.from('nutrition_plans').insert({
          coach_id: coachId, client_id: clientId, active: true,
          calories: profile.kcal ?? null, protein: profile.protein ?? null,
          carbs: profile.carbs ?? null, fats: profile.fats ?? null, meals: [], notes,
        })
        if (error) {
          console.log('    ✗ error insert nutrition_plans:', error.message)
          errors.push({ client: key, step: 'nutrition_plans.insert', message: error.message })
        }
      }
    }
  } else if (hasNutrition && !APPLY) {
    console.log('  DB nutrition_plans: CREAR al aplicar (cliente nuevo).')
  }

  // 3) workout_plans (no duplicar: si ya hay plan activo, omitir)
  if (routine?.days.length && clientId && clientId !== '(se crea al aplicar)') {
    const { data: wp } = await sb.from('workout_plans').select('id').eq('client_id', clientId).eq('active', true).limit(1)
    if (wp?.length) {
      console.log('  DB workout_plans: ya tiene plan activo → se omite (no duplica).')
    } else {
      const title = `Rutina ${routine.days.length} días — ${routine.days.map((d) => d.focus).join(' / ')}`.slice(0, 180)
      console.log('  DB workout_plans: CREAR →', title)
      if (APPLY) {
        const { error } = await sb.from('workout_plans').insert({
          coach_id: coachId, client_id: clientId, active: true,
          title, days: routine.days, exercises: [], notes: null,
        })
        if (error) {
          console.log('    ✗ error insert workout_plans:', error.message)
          errors.push({ client: key, step: 'workout_plans.insert', message: error.message })
        }
      }
    }
  } else if (routine?.days.length && !APPLY) {
    console.log('  DB workout_plans: CREAR al aplicar (cliente nuevo).')
  }
}

// ── Resolución de coach según la FK REAL ──────────────────────────────────────
// clients.coach_id → public.profiles(id) → auth.users(id).
// OJO: public.profiles NO tiene columna email (el email vive en auth.users), por eso
// COACH_EMAIL se resuelve vía Admin API de auth y luego se valida que exista el profile.
// Nunca devolvemos un id que no exista en public.profiles (sería FK violation).
const shortId = (id) => String(id).slice(0, 8)
function logCoach(prof, source) {
  const roleWarn = prof.role !== 'coach' ? `  ⚠ role='${prof.role}' (esperado 'coach')` : ''
  console.log(`coach_id: ${shortId(prof.id)}…  (${prof.full_name || 's/nombre'})  vía ${source}${roleWarn}`)
}

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

  // 1) COACH_ID explícito: SOLO se acepta si existe en public.profiles.
  if (wantId) {
    const prof = await getProfileById(sb, wantId)
    if (prof) { logCoach(prof, 'COACH_ID'); return prof.id }
    if (!wantEmail) {
      throw new Error(
        `COACH_ID no existe en public.profiles (id=${shortId(wantId)}…).\n` +
        '   clients.coach_id referencia public.profiles(id), NO auth.users. Por eso falla la FK.\n' +
        '   Solución: usá COACH_EMAIL del coach, o pasá un COACH_ID que sí exista en public.profiles.')
    }
    console.log('  ⚠ COACH_ID no existe en profiles — intento resolver por COACH_EMAIL…')
  }

  // 2) COACH_EMAIL: auth.users (Admin API) → id → validar profile.
  if (wantEmail) {
    const user = await findAuthUserByEmail(sb, wantEmail)
    if (!user) {
      throw new Error(
        `No existe ningún usuario de auth con email "${wantEmail}".\n` +
        '   Registrá ese coach (o corregí el email) antes de importar.')
    }
    const prof = await getProfileById(sb, user.id)
    if (!prof) {
      throw new Error(
        `"${wantEmail}" existe en auth.users (id=${shortId(user.id)}…) pero NO tiene fila en public.profiles.\n` +
        '   La FK clients.coach_id exige un profile. El trigger handle_new_user no corrió para este usuario.\n' +
        '   SQL manual en Supabase (SQL Editor):\n' +
        `   insert into public.profiles (id, full_name, role) values ('${user.id}', 'Coach', 'coach')\n` +
        "   on conflict (id) do update set role='coach';")
    }
    logCoach(prof, 'COACH_EMAIL')
    return prof.id
  }

  // 3) Sin pistas: un único profile con role='coach'.
  const { data: coaches, error } = await sb.from('profiles')
    .select('id, full_name, role').eq('role', 'coach').limit(2)
  if (error) throw new Error('No se pudo consultar public.profiles: ' + error.message)
  if (!coaches?.length) {
    throw new Error(
      "No se pudo resolver el coach: no hay COACH_ID válido, ni COACH_EMAIL, ni ningún profile con role='coach'.\n" +
      '   PowerShell:  $env:COACH_EMAIL=\'coach@dominio.com\'\n' +
      '   Bash:        export COACH_EMAIL=\'coach@dominio.com\'')
  }
  if (coaches.length > 1) {
    throw new Error("Hay más de un profile con role='coach'. Definí COACH_EMAIL o COACH_ID para elegir sin ambigüedad.")
  }
  logCoach(coaches[0], "profiles.role='coach'")
  return coaches[0].id
}

// ── Verificación read-only ────────────────────────────────────────────────────
async function verifyClient(sb, key) {
  const slug = CLIENTS[key].slug
  console.log(`\n── ${key} (slug='${slug}') ──`)
  const { data: client, error } = await sb.from('clients')
    .select('id, slug, full_name, objective, age, weight, height, status')
    .eq('slug', slug).maybeSingle()
  if (error) { console.log('  ✗ error consultando clients:', error.message); return }
  if (!client) { console.log('  clients: NO EXISTE'); return }
  console.log(`  clients: EXISTE  id=${shortId(client.id)}…  "${client.full_name}"  · obj=${client.objective ?? '—'} · ${client.weight ?? '—'}kg/${client.height ?? '—'}cm · ${client.status}`)

  const { data: nps } = await sb.from('nutrition_plans')
    .select('id, calories, protein, carbs, fats, active').eq('client_id', client.id)
  if (!nps?.length) console.log('  nutrition_plans: 0')
  else {
    const a = nps.find((n) => n.active) || nps[0]
    console.log(`  nutrition_plans: ${nps.length} (activos: ${nps.filter((n) => n.active).length})  · ${a.calories ?? '—'}kcal  P${a.protein ?? '—'}/C${a.carbs ?? '—'}/G${a.fats ?? '—'}`)
  }

  const { data: wps } = await sb.from('workout_plans')
    .select('id, title, days, active').eq('client_id', client.id)
  if (!wps?.length) console.log('  workout_plans: 0')
  else {
    const a = wps.find((w) => w.active) || wps[0]
    const nDays = Array.isArray(a.days) ? a.days.length : 0
    const nEx = Array.isArray(a.days) ? a.days.reduce((s, d) => s + (d.exercises?.length || 0), 0) : 0
    console.log(`  workout_plans: ${wps.length} (activos: ${wps.filter((w) => w.active).length})  · ${nDays} días, ${nEx} ejercicios`)
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // Modo parse-only: sin DB, sin credenciales. Solo valida la extracción.
  if (PARSE_ONLY) {
    console.log('\n=== Import asesorados  [PARSE-ONLY · sin DB] ===')
    const targets = argClient ? [argClient] : Object.keys(CLIENTS)
    for (const key of targets) {
      if (key === 'lu' || !CLIENTS[key]) continue
      await processClient(null, key, null, [])
    }
    console.log('\nPARSE-ONLY: no se conectó a Supabase ni se escribió nada.\n')
    return
  }

  // ── Validación de entorno (NUNCA imprime secretos) ─────────────────────────
  const url = process.env.SUPABASE_URL || readEnvLocal('VITE_SUPABASE_URL')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const missing = []
  if (!key) missing.push('SUPABASE_SERVICE_ROLE_KEY  (del entorno; nunca de archivos)')
  if (!url) missing.push('SUPABASE_URL  (o VITE_SUPABASE_URL en .env.local)')
  if (missing.length) {
    exit('Faltan variables de entorno:\n   - ' + missing.join('\n   - ') +
      '\n\n   PowerShell:\n     $env:SUPABASE_SERVICE_ROLE_KEY=\'<service-role-key>\'\n     $env:SUPABASE_URL=\'https://<ref>.supabase.co\'   # opcional si está en .env.local' +
      '\n   Bash:\n     export SUPABASE_SERVICE_ROLE_KEY=\'<service-role-key>\'\n     export SUPABASE_URL=\'https://<ref>.supabase.co\'')
  }

  const sb = createClient(url, key, { auth: { persistSession: false } })

  // ── Modo verify: solo lectura, resumen compacto ────────────────────────────
  if (VERIFY) {
    console.log('\n=== Verificación asesorados  [READ-ONLY] ===')
    const targets = argClient ? [argClient] : Object.keys(CLIENTS)
    for (const k of targets) {
      if (k === 'lu' || !CLIENTS[k]) continue
      await verifyClient(sb, k)
    }
    console.log('')
    return
  }

  console.log(`\n=== Import asesorados  [${APPLY ? 'APPLY' : 'DRY-RUN'}] ===`)

  // ── Coach resuelto y VALIDADO contra public.profiles antes de tocar nada ────
  let coachId
  try {
    coachId = await resolveCoachId(sb)
  } catch (e) {
    exit(e.message)
  }

  const errors = []
  const targets = argClient ? [argClient] : Object.keys(CLIENTS)
  for (const k of targets) {
    if (k === 'lu') { console.log('\n(omitiendo lu — perfil modelo, no se toca)'); continue }
    if (!CLIENTS[k]) { console.log(`\n⚠ Cliente desconocido: ${k} (válidos: ${Object.keys(CLIENTS).join(', ')})`); continue }
    await processClient(sb, k, coachId, errors)
  }

  // ── Resultado final: distinguir DRY-RUN de APPLY y NO mentir nunca ──────────
  if (!APPLY) {
    console.log('\n✓ DRY-RUN OK: no se escribió nada. Reejecutá con --apply para aplicar.\n')
    return
  }
  if (errors.length) {
    console.error('\n✗ APPLY falló')
    for (const e of errors) console.error(`   - ${e.client} · ${e.step}: ${e.message}`)
    console.error('   Si falló la creación del client, NO se creó su nutrición ni rutina.\n')
    process.exit(1)
  }
  console.log('\n✓ APPLY OK — escrito sin errores.\n')
}

function readEnvLocal(name) {
  try {
    const env = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
    const m = env.match(new RegExp('^' + name + '=(.*)$', 'm'))
    return m ? m[1].trim() : null
  } catch { return null }
}
function exit(msg) { console.error('\n✗ ' + msg + '\n'); process.exit(1) }

main().catch((e) => exit(e.message))
