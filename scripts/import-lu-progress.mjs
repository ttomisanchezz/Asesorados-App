// =============================================================================
// import-lu-progress.mjs
// Importa el peso histórico del Excel "Peso y medidas LU.xlsx" a progress_metrics.
//
// SEGURIDAD:
//   - DRY-RUN por defecto. Solo escribe con --apply.
//   - La service_role key NUNCA se lee de archivos ni se imprime: solo desde
//     la variable de entorno SUPABASE_SERVICE_ROLE_KEY en runtime.
//   - Idempotente: no inserta un registro si ya existe uno para esa fecha.
//   - No borra ni sobrescribe medidas existentes.
//
// USO (PowerShell):
//   $env:SUPABASE_SERVICE_ROLE_KEY="..."; node scripts/import-lu-progress.mjs           # dry-run
//   $env:SUPABASE_SERVICE_ROLE_KEY="..."; node scripts/import-lu-progress.mjs --apply    # escribe
//
//   Opcional para identificar a LU sin ambigüedad:
//   $env:LU_SLUG="lu"   ó   $env:LU_NAME="Lucía ..."
// =============================================================================

import fs from 'node:fs'
import zlib from 'node:zlib'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const XLSX_PATH = path.join(ROOT, 'imports', 'lu', 'Peso y medidas LU.xlsx')
const APPLY = process.argv.includes('--apply')
const IMPORT_TAG = 'import:xlsx peso-y-medidas-lu'

// ── Mini lector de XLSX (ZIP) sin dependencias ───────────────────────────────
function readZipEntry(buf, wantName) {
  // Localiza End Of Central Directory
  let eocd = -1
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('ZIP inválido (sin EOCD)')
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
  throw new Error(`Entrada no encontrada en el xlsx: ${wantName}`)
}

// ── Parseo de la hoja a registros {date, weight} ─────────────────────────────
function serialToISO(s) {
  const n = parseFloat(s)
  if (!isFinite(n)) return null
  return new Date(Date.UTC(1899, 11, 30) + n * 86400000).toISOString().slice(0, 10)
}

function parseExcel() {
  const buf = fs.readFileSync(XLSX_PATH)
  const ssXml = readZipEntry(buf, 'xl/sharedStrings.xml').toString('utf8')
  const strings = [...ssXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join(''),
  )
  const sheet = readZipEntry(buf, 'xl/worksheets/sheet1.xml').toString('utf8')
  const colL = (r) => r.replace(/[0-9]+/g, '')
  const rowN = (r) => parseInt(r.replace(/[A-Z]+/g, ''), 10)
  const rows = {}
  const cRe = /<c r="([A-Z]+[0-9]+)"(?:[^>]*?t="([^"]*)")?[^>]*>(?:<v>([\s\S]*?)<\/v>|<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>)?<\/c>/g
  let c
  while ((c = cRe.exec(sheet))) {
    const ref = c[1]
    const t = c[2]
    let val = c[3] !== undefined ? c[3] : c[4] !== undefined ? c[4] : ''
    if (t === 's') val = strings[parseInt(val, 10)]
    ;(rows[rowN(ref)] = rows[rowN(ref)] || {})[colL(ref)] = val
  }
  const recs = []
  for (const r of Object.keys(rows).map(Number).sort((a, b) => a - b)) {
    if (r < 9) continue // filas 1-8 = títulos/encabezado
    const C = rows[r].C, D = rows[r].D
    if (C === undefined || D === undefined) continue // sin fecha o sin peso → se ignora
    const date = serialToISO(C)
    const weight = parseFloat(String(D).replace(',', '.'))
    if (!date || !isFinite(weight)) continue
    recs.push({ row: r, date, weight: Math.round(weight * 100) / 100 })
  }
  return recs
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const url = process.env.SUPABASE_URL || readEnvLocal('VITE_SUPABASE_URL')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) exit('Falta SUPABASE_URL (o VITE_SUPABASE_URL en .env.local).')
  if (!key) exit('Falta SUPABASE_SERVICE_ROLE_KEY en el entorno. No se lee de archivos.')

  const sb = createClient(url, key, { auth: { persistSession: false } })

  console.log(`\n=== Import LU → progress_metrics  [${APPLY ? 'APPLY' : 'DRY-RUN'}] ===`)

  // 1) Registros del Excel
  const recs = parseExcel()
  console.log(`\nExcel: ${recs.length} registros con fecha+peso (${recs[0].date} → ${recs[recs.length - 1].date})`)
  // Aviso de fechas fuera de orden (posible typo en el Excel — NO se corrige)
  for (let i = 1; i < recs.length; i++) {
    if (recs[i].date < recs[i - 1].date) {
      console.log(`  ⚠ fila ${recs[i].row}: fecha ${recs[i].date} fuera de secuencia (anterior ${recs[i - 1].date}) — se importa tal cual`)
    }
  }

  // 2) Identificar a LU
  const luSlug = process.env.LU_SLUG
  const luName = process.env.LU_NAME
  let q = sb.from('clients').select('id, full_name, slug, coach_id, weight')
  if (luSlug) q = q.eq('slug', luSlug)
  else if (luName) q = q.ilike('full_name', luName)
  else q = q.or('slug.ilike.%lu%,full_name.ilike.%lu%')
  const { data: candidates, error: cErr } = await q
  if (cErr) exit('Error buscando cliente: ' + cErr.message)
  if (!candidates?.length) exit('No se encontró ningún cliente para LU. Definí LU_SLUG o LU_NAME.')
  if (candidates.length > 1) {
    console.log('\nVarios candidatos — desambiguá con LU_SLUG o LU_NAME:')
    candidates.forEach((c) => console.log(`  - ${c.full_name}  (slug=${c.slug})  id=${String(c.id).slice(0, 8)}…`))
    exit('Ambiguo: hay más de un cliente.')
  }
  const lu = candidates[0]
  console.log(`\nLU identificada: ${lu.full_name}  (slug=${lu.slug})  id=${String(lu.id).slice(0, 8)}…  coach=${String(lu.coach_id).slice(0, 8)}…`)
  console.log(`Peso actual en clients: ${lu.weight ?? '(sin dato)'} kg`)

  // 3) Registros ya existentes (para no duplicar)
  const { data: existing, error: eErr } = await sb
    .from('progress_metrics')
    .select('created_at, weight')
    .eq('client_id', lu.id)
  if (eErr) exit('Error leyendo progress_metrics: ' + eErr.message)
  const existingDates = new Set((existing ?? []).map((r) => String(r.created_at).slice(0, 10)))
  console.log(`progress_metrics existentes: ${existing?.length ?? 0}`)

  // 4) Plan de inserción
  const toInsert = recs.filter((r) => !existingDates.has(r.date))
  const skipped = recs.length - toInsert.length
  console.log(`\nA insertar: ${toInsert.length}  |  Ya existen (se omiten): ${skipped}`)
  toInsert.forEach((r) => console.log(`  + ${r.date}  ${r.weight} kg`))

  // 5) Peso actual del panel
  const latest = recs[recs.length - 1] // último por orden de fecha del Excel
  const today = new Date().toISOString().slice(0, 10)
  const todayRec = recs.find((r) => r.date === today)
  const weightForPanel = todayRec ?? latest
  console.log(
    `\nPeso actual del panel → ${weightForPanel.weight} kg ` +
      `(${todayRec ? 'fila de HOY ' + today : 'último disponible ' + latest.date})`,
  )

  if (!APPLY) {
    console.log('\nDRY-RUN: no se escribió nada. Reejecutá con --apply para aplicar.\n')
    return
  }

  // 6) Insertar (created_at = fecha del Excel, notes = tag de trazabilidad)
  if (toInsert.length) {
    const payload = toInsert.map((r) => ({
      client_id: lu.id,
      coach_id: lu.coach_id,
      weight: r.weight,
      notes: IMPORT_TAG,
      created_at: `${r.date}T12:00:00Z`,
    }))
    const { error: iErr } = await sb.from('progress_metrics').insert(payload)
    if (iErr) exit('Error insertando: ' + iErr.message)
    console.log(`\n✓ Insertados ${payload.length} registros en progress_metrics.`)
  } else {
    console.log('\nNada nuevo para insertar.')
  }

  // 7) Actualizar peso actual del panel
  const { error: uErr } = await sb
    .from('clients')
    .update({ weight: weightForPanel.weight })
    .eq('id', lu.id)
  if (uErr) exit('Error actualizando clients.weight: ' + uErr.message)
  console.log(`✓ clients.weight actualizado a ${weightForPanel.weight} kg.\n`)
}

function readEnvLocal(name) {
  try {
    const env = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
    const m = env.match(new RegExp('^' + name + '=(.*)$', 'm'))
    return m ? m[1].trim() : null
  } catch {
    return null
  }
}

function exit(msg) {
  console.error('\n✗ ' + msg + '\n')
  process.exit(1)
}

main().catch((e) => exit(e.message))
