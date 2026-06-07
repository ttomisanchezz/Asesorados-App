// =============================================================================
// dietParser.mjs — Extrae plan nutricional real desde imports/<cliente>/dieta.docx
//
// Produce el MISMO formato que ya usa la UI (igual que el plan de Lu):
//   { calories, protein, carbs, fats, objective, description, meals }
//   meals: [{ scheme, description, meals: [{ name, options: [{ title, items[], kcal, macros:{p,c,f} }] }] }]
//
// NO inventa datos: lo que no está en el docx queda null/ausente.
// Soporta los dos layouts reales encontrados en las plantillas:
//   A) una tabla por COMIDA, cada fila = una opción ya totalizada (eze).
//   B) una tabla por OPCIÓN, filas = alimentos + fila "TOTAL" (giselle/mateo/tomi).
// =============================================================================
import fs from 'node:fs'
import zlib from 'node:zlib'

// ── Lectura de DOCX (ZIP) ────────────────────────────────────────────────────
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

const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")

// IMPORTANTE: <w:t ...> debe distinguirse de <w:tbl>, <w:tc>, <w:tr>, <w:top>…
// Exigimos que después de "w:t" venga un espacio o el cierre ">".
const T_RE = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g
const cellText = (xml) => [...xml.matchAll(T_RE)].map((x) => decode(x[1])).join('').replace(/\s+/g, ' ').trim()

// Camina los bloques de nivel superior (párrafos y tablas) EN ORDEN de documento.
export function walkBlocks(buf) {
  const docXml = readZipEntry(buf, 'word/document.xml')
  if (!docXml) return []
  const xml = docXml.toString('utf8')
  const body = xml.slice(xml.indexOf('<w:body>'), xml.indexOf('</w:body>'))
  const blocks = []
  const re = /<w:tbl>[\s\S]*?<\/w:tbl>|<w:p[ >][\s\S]*?<\/w:p>/g
  let m
  while ((m = re.exec(body))) {
    const chunk = m[0]
    if (chunk.startsWith('<w:tbl')) {
      const rows = [...chunk.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)].map((r) =>
        [...r[0].matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)].map((c) => cellText(c[0])))
      if (rows.length) blocks.push({ type: 'table', rows })
    } else {
      const text = cellText(chunk)
      if (text) blocks.push({ type: 'p', text })
    }
  }
  return blocks
}

// ── Helpers numéricos / texto ────────────────────────────────────────────────
const firstNum = (s) => {
  const m = String(s ?? '').replace(',', '.').match(/-?\d+(\.\d+)?/)
  return m ? parseFloat(m[0]) : null
}
const intOf = (s) => { const n = firstNum(s); return n == null ? null : Math.round(n) }
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

// Pares "label / valor" en párrafos consecutivos (datos del perfil).
function pairValue(paras, label) {
  const L = norm(label)
  for (let i = 0; i < paras.length - 1; i++) if (norm(paras[i]) === L) return paras[i + 1].trim()
  return null
}

// ── Macros del plan (Proteína/Grasas/Carbohidratos → g/día) ──────────────────
function parseMacros(tables) {
  // 1) Tabla de 3 columnas: Variable | Cálculo | Resultado/Objetivo diario.
  for (const t of tables) {
    const h = (t.rows[0] || []).map(norm)
    const isMacroTable = h.includes('calculo') || h.includes('resultado') || h.join(' ').includes('objetivo diario')
    if (!isMacroTable) continue
    const res = { protein: null, carbs: null, fats: null }
    for (const row of t.rows.slice(1)) {
      const label = norm(row[0])
      const last = row[row.length - 1] // columna "Resultado/Objetivo diario" (ej. "115 g/día")
      if (/^prote/.test(label)) res.protein = intOf(last)
      else if (/grasa/.test(label)) res.fats = intOf(last)
      else if (/carbo|hidrato/.test(label)) res.carbs = intOf(last)
    }
    if (res.protein != null || res.carbs != null || res.fats != null) return res
  }
  // 2) Fallback: fila única Calorías | Proteínas | Grasas | Carbohidratos (toma el primer nº; si es rango, el menor).
  for (const t of tables) {
    const h = (t.rows[0] || []).map(norm)
    if (h[0] === 'calorias' && h.includes('proteinas') && h.includes('grasas') && h.includes('carbohidratos') && t.rows[1]) {
      const idx = (name) => h.indexOf(name)
      return {
        protein: intOf(t.rows[1][idx('proteinas')]),
        fats: intOf(t.rows[1][idx('grasas')]),
        carbs: intOf(t.rows[1][idx('carbohidratos')]),
      }
    }
  }
  return { protein: null, carbs: null, fats: null }
}

// Calorías objetivo del plan (fila única "X kcal", o fila "Superávit/Calorías iniciales").
function parseCalories(blocks, tables) {
  for (const t of tables) {
    const h = (t.rows[0] || []).map(norm)
    if (h[0] === 'calorias' && t.rows[1]) { const v = intOf(t.rows[1][0]); if (v) return v }
  }
  for (const t of tables) {
    for (const row of t.rows) {
      const label = norm(row[0])
      if (/superavit|calorias iniciales|objetivo calorico/.test(label)) {
        const v = intOf(row[row.length - 1]); if (v) return v
      }
    }
  }
  const paras = blocks.filter((b) => b.type === 'p').map((b) => b.text)
  const header = paras.find((p) => /\d{3,4}\s*kcal/i.test(p))
  return header ? intOf(header.match(/(\d{3,4})\s*kcal/i)[1]) : null
}

// ── Detección de tablas de comida ────────────────────────────────────────────
function isMealTable(rows) {
  const h = (rows[0] || []).map(norm)
  const joined = h.join('|')
  return /\bkcal\b/.test(joined) && /prot/.test(joined) && (h[0].startsWith('opcion') || h[0].startsWith('alimento'))
}
function macroColumns(headerRow) {
  const h = headerRow.map(norm)
  const find = (re) => h.findIndex((x) => re.test(x))
  return { kcal: find(/kcal/), p: find(/prot/), c: find(/carb/), f: find(/grasa/) }
}

const MEAL_RE = /(desayuno|almuerzo|merienda|cena|colaci[oó]n|pre.?entreno|post.?entreno|pre entreno|post entreno)/i
const SCHEME_RE = /d[ií]as de (entrenamiento|descanso)|d[ií]as? (de )?entren|d[ií]as? (de )?descanso/i

function titleMeal(s) {
  s = String(s || '').replace(/[-–:]\s*$/, '').trim()
  if (s && s === s.toUpperCase()) return s.charAt(0) + s.slice(1).toLowerCase()
  return s
}
// "Desayuno - Opción 1" → { meal:'Desayuno', optTitle:'Opción 1' }
function labelToMealOption(h) {
  if (!h) return { meal: 'Comida', optTitle: null }
  let meal = h
  let optTitle = null
  const parts = h.split(/\s+[-–]\s+/)
  if (parts.length > 1) {
    meal = parts[0]
    const rest = parts.slice(1).join(' - ')
    const om = rest.match(/opci[oó]n\s*\d+/i)
    optTitle = om ? om[0].replace(/^./, (c) => c.toUpperCase()) : null
  } else {
    const om = h.match(/opci[oó]n\s*\d+/i)
    if (om) { optTitle = om[0].replace(/^./, (c) => c.toUpperCase()); meal = h.slice(0, om.index) }
  }
  return { meal: titleMeal(meal), optTitle }
}

// ── Esquemas / comidas / opciones ────────────────────────────────────────────
function parseMeals(blocks) {
  const schemes = []
  let curScheme = null
  let lastMealLabel = null

  const ensureScheme = (name, description = '') => {
    curScheme = { scheme: name, description, meals: [] }
    schemes.push(curScheme)
    return curScheme
  }
  const getMeal = (scheme, name) => {
    let m = scheme.meals.find((x) => norm(x.name) === norm(name))
    if (!m) { m = { name, options: [] }; scheme.meals.push(m) }
    return m
  }

  for (const b of blocks) {
    if (b.type === 'p') {
      const t = b.text.trim()
      if (SCHEME_RE.test(t) && !isLongProse(t)) ensureScheme(cleanSchemeName(t))
      else if (MEAL_RE.test(t) && !isLongProse(t)) lastMealLabel = t
      continue
    }
    if (!isMealTable(b.rows)) continue
    if (!curScheme) ensureScheme('Plan de comidas')
    const cols = macroColumns(b.rows[0])
    const layoutA = norm(b.rows[0][0]).startsWith('opcion')
    const { meal, optTitle } = labelToMealOption(lastMealLabel)
    const mealObj = getMeal(curScheme, meal)

    if (layoutA) {
      // Una fila = una opción ya totalizada.
      for (const row of b.rows.slice(1)) {
        if (!row[1]) continue
        const items = String(row[1]).split(/\s*\+\s*/).map((s) => s.trim()).filter(Boolean)
        const num = String(row[0] || '').trim()
        mealObj.options.push({
          title: /opci/i.test(num) ? num : `Opción ${num || mealObj.options.length + 1}`,
          items,
          kcal: intOf(row[cols.kcal]),
          macros: { p: intOf(row[cols.p]), c: intOf(row[cols.c]), f: intOf(row[cols.f]) },
        })
      }
    } else {
      // Filas = alimentos; última fila "TOTAL …" trae los totales de la opción.
      const items = []
      let total = null
      for (const row of b.rows.slice(1)) {
        if (/^total/.test(norm(row[0]))) { total = row; continue }
        const name = (row[0] || '').trim()
        if (!name) continue
        const portion = (row[1] || '').trim()
        items.push(portion && portion !== '·' ? `${name} — ${portion}` : name)
      }
      if (!items.length) continue
      mealObj.options.push({
        title: optTitle || `Opción ${mealObj.options.length + 1}`,
        items,
        kcal: total ? intOf(total[cols.kcal]) : null,
        macros: total
          ? { p: intOf(total[cols.p]), c: intOf(total[cols.c]), f: intOf(total[cols.f]) }
          : { p: null, c: null, f: null },
      })
    }
  }

  return schemes
    .map((s) => ({ ...s, meals: s.meals.filter((m) => m.options.length) }))
    .filter((s) => s.meals.length)
}

// Prosa larga = párrafo descriptivo, no un encabezado.
const isLongProse = (t) => t.length > 60
function cleanSchemeName(t) {
  return t.replace(/^\d+\.\s*/, '').replace(/:.*$/, '').trim()
}

// ── Perfil mínimo (peso para reportar fórmulas g/kg si hiciera falta) ────────
function parseProfile(paras) {
  const objectiveMain = pairValue(paras, 'Objetivo principal')
  const weight = firstNum(pairValue(paras, 'Peso actual'))
  return { objective: objectiveMain || null, weight }
}

function buildDescription(blocks, objective) {
  const paras = blocks.filter((b) => b.type === 'p').map((b) => b.text)
  // Primer párrafo de prosa real (no encabezado, no número suelto).
  const prose = paras.find((p) => p.length > 70 && !/^\d+\./.test(p) && !MEAL_RE.test(p.slice(0, 20)))
  return [objective ? `Objetivo: ${objective}` : null, prose].filter(Boolean).join('\n\n')
}

// Texto plano de TODOS los bloques en orden (incluye celdas de tabla), para
// resolver pares "label/valor" del perfil que viven dentro de tablas.
function flatTexts(blocks) {
  const out = []
  for (const b of blocks) {
    if (b.type === 'p') out.push(b.text)
    else for (const row of b.rows) for (const cell of row) if (cell) out.push(cell)
  }
  return out
}

// ── API principal ────────────────────────────────────────────────────────────
export function parseDietDocx(buf) {
  const blocks = walkBlocks(buf)
  const tables = blocks.filter((b) => b.type === 'table')
  const profile = parseProfile(flatTexts(blocks))
  const macros = parseMacros(tables)
  const calories = parseCalories(blocks, tables)
  const meals = parseMeals(blocks)
  return {
    calories,
    protein: macros.protein,
    carbs: macros.carbs,
    fats: macros.fats,
    objective: profile.objective,
    weight: profile.weight,
    description: buildDescription(blocks, profile.objective),
    meals,
  }
}

export function parseDietFile(filePath) {
  return parseDietDocx(fs.readFileSync(filePath))
}
