// =============================================================================
// inspect-imports.mjs  —  SOLO LECTURA, NO toca Supabase.
// Recorre imports/<cliente>/ y extrae el contenido de cada .xlsx y .docx
// para entender qué datos hay antes de armar el import real.
//
// USO:  node scripts/inspect-imports.mjs
//       node scripts/inspect-imports.mjs eze      (filtra un cliente)
// =============================================================================

import fs from 'node:fs'
import zlib from 'node:zlib'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const IMPORTS = path.join(ROOT, 'imports')
const onlyClient = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null
const SUMMARY = process.argv.includes('--summary')

// ── ZIP entry reader (xlsx/docx son ZIP) ─────────────────────────────────────
function listZipEntries(buf) {
  let eocd = -1
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  }
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
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('ZIP inválido')
  const entries = buf.readUInt16LE(eocd + 10)
  let off = buf.readUInt32LE(eocd + 16)
  for (let e = 0; e < entries; e++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break
    const compSize = buf.readUInt32LE(off + 20)
    const nameLen = buf.readUInt16LE(off + 28)
    const extraLen = buf.readUInt16LE(off + 30)
    const commentLen = buf.readUInt16LE(off + 32)
    const localOff = buf.readUInt32LE(off + 42)
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen)
    const method = buf.readUInt16LE(off + 10)
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

const colL = (r) => r.replace(/[0-9]+/g, '')
const rowN = (r) => parseInt(r.replace(/[A-Z]+/g, ''), 10)

// ── XLSX → matriz de celdas por hoja ─────────────────────────────────────────
function readXlsx(buf) {
  const ssXml = readZipEntry(buf, 'xl/sharedStrings.xml')
  const strings = ssXml
    ? [...ssXml.toString('utf8').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
        [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => decode(x[1])).join(''))
    : []
  const sheets = listZipEntries(buf).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort()
  const out = []
  for (const sheetName of sheets) {
    const sheet = readZipEntry(buf, sheetName).toString('utf8')
    const cRe = /<c r="([A-Z]+[0-9]+)"(?:[^>]*?t="([^"]*)")?[^>]*>(?:<v>([\s\S]*?)<\/v>|<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>)?<\/c>/g
    const rows = {}
    let c
    while ((c = cRe.exec(sheet))) {
      const ref = c[1], t = c[2]
      let val = c[3] !== undefined ? c[3] : c[4] !== undefined ? c[4] : ''
      if (t === 's') val = strings[parseInt(val, 10)]
      if (val !== '' && val !== undefined) (rows[rowN(ref)] = rows[rowN(ref)] || {})[colL(ref)] = decode(String(val))
    }
    out.push({ sheet: sheetName, rows })
  }
  return out
}

// ── DOCX → párrafos de texto ─────────────────────────────────────────────────
function readDocx(buf) {
  const docXml = readZipEntry(buf, 'word/document.xml')
  if (!docXml) return []
  const xml = docXml.toString('utf8')
  const paras = [...xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map((m) =>
    [...m[0].matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((x) => decode(x[1])).join(''))
  return paras.map((p) => p.trim()).filter(Boolean)
}

function decode(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
}

// ── Main ─────────────────────────────────────────────────────────────────────
const clients = fs.readdirSync(IMPORTS, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .filter((n) => !onlyClient || n === onlyClient)
  .sort()

for (const client of clients) {
  const dir = path.join(IMPORTS, client)
  const files = fs.readdirSync(dir)
  console.log(`\n${'='.repeat(70)}\nCLIENTE: ${client}   (archivos: ${files.join(', ')})\n${'='.repeat(70)}`)

  for (const file of files) {
    const full = path.join(dir, file)
    const ext = path.extname(file).toLowerCase()
    let buf
    try { buf = fs.readFileSync(full) } catch { continue }

    if (ext === '.xlsx') {
      console.log(`\n── ${file} (XLSX) ──`)
      try {
        const sheets = readXlsx(buf)
        console.log(`  ${sheets.length} hoja(s)`)
        const { sheet, rows } = sheets[0] // hoja 1 = canónica
        const rowNums = Object.keys(rows).map(Number).sort((a, b) => a - b)
        if (SUMMARY) {
          // Solo filas de identidad y cabeceras de día.
          for (const r of rowNums) {
            const line = Object.entries(rows[r]).map(([col, v]) => `${col}=${v}`).join(' | ')
            if (/ASESORADO|OBJETIVO|^A=DIA|DIA \d/i.test(line) || r === 5) console.log(`    fila ${r}: ${line}`)
          }
        } else {
          console.log(`  [${sheet}] ${rowNums.length} filas`)
          for (const r of rowNums.slice(0, 40)) {
            console.log(`    fila ${r}: ${Object.entries(rows[r]).map(([col, v]) => `${col}=${v}`).join(' | ')}`)
          }
          if (rowNums.length > 40) console.log(`    … (+${rowNums.length - 40} filas más)`)
        }
      } catch (e) { console.log('  ✗ error leyendo xlsx:', e.message) }
    } else if (ext === '.docx') {
      console.log(`\n── ${file} (DOCX) ──`)
      try {
        const paras = readDocx(buf)
        const limit = SUMMARY ? 22 : 60
        console.log(`  ${paras.length} párrafos de texto`)
        paras.slice(0, limit).forEach((p, i) => console.log(`    ${String(i + 1).padStart(2)}: ${p.slice(0, 120)}`))
        if (paras.length > limit) console.log(`    … (+${paras.length - limit} párrafos más)`)
      } catch (e) { console.log('  ✗ error leyendo docx:', e.message) }
    } else {
      console.log(`\n── ${file} (${ext || 'sin extensión'}) — no inspeccionado`)
    }
  }
}
console.log('')
