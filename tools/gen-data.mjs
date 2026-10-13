import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Resolve the extracted workbook dir, then self-heal: temp/work dirs get
// cleaned, so re-extract from the source .xlsx if no candidate survives.
// This workbook is saved with a nested xl/xl/ layout, so probe rather than assume.
const HERE = dirname(fileURLToPath(import.meta.url))
const WORK = join(HERE, '.work')
const SRC = join(HERE, '..', 'Last Update 2026.xlsx')
const probe = (d) => existsSync(join(d, 'sharedStrings.xml'))
const findBase = () => {
  const roots = [WORK, join(WORK, 'xl'), join(WORK, 'xl', 'xl'), join(WORK, 'xl2')]
  for (const r of roots) {
    if (probe(r)) return r
    for (const sub of ['xl', join('xl', 'xl')]) {
      if (probe(join(r, sub))) return join(r, sub)
    }
  }
  return null
}
let BASE = findBase()
if (!BASE) {
  mkdirSync(WORK, { recursive: true })
  execFileSync('powershell', [
    '-NoProfile',
    '-Command',
    `Add-Type -A System.IO.Compression.FileSystem; ` +
      `[IO.Compression.ZipFile]::ExtractToDirectory('${SRC}', '${WORK}')`,
  ])
  BASE = findBase()
  if (!BASE) throw new Error(`could not locate sharedStrings.xml under ${WORK}`)
}
const OUT_DATA = join(HERE, '..', 'src', 'data')
const dec = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&')

// shared strings
const ssXml = readFileSync(`${BASE}/sharedStrings.xml`, 'utf8')
const shared = [...ssXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
  dec([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')),
)

// cells -> Map<col, Map<row, string>>
const sheetXml = readFileSync(`${BASE}/worksheets/sheet2.xml`, 'utf8')
const grid = new Map()
for (const m of sheetXml.matchAll(/<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
  const [, col, rowStr, attrs, inner = ''] = m
  const row = +rowStr
  const t = attrs.match(/t="([^"]+)"/)?.[1]
  let val = null
  if (t === 's') {
    const v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1]
    if (v !== undefined) val = shared[+v]
  } else if (t === 'inlineStr') {
    val = dec([...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join(''))
  } else {
    const v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1]
    if (v !== undefined) val = dec(v)
  }
  if (val == null || val.trim() === '') continue
  if (!grid.has(col)) grid.set(col, new Map())
  grid.get(col).set(row, val.trim())
}

const at = (col, row) => grid.get(col)?.get(row) ?? null
const clean = (s) => s.replace(/_/g, ' ').replace(/\s+/g, ' ').trim()

// Arabic-insensitive key so "أسوان" (master list) matches "اسوان" (city-block header).
const normKey = (s) =>
  s
    .replace(/[\u064B-\u0652\u0640]/g, '')
    .replace(/[\u0623\u0625\u0622\u0671]/g, '\u0627')
    .replace(/\u0629/g, '\u0647')
    .replace(/[\u0624\u0626\u0649]/g, '\u064A')
    .replace(/\s+/g, ' ')
    .trim()

// Reviewable, explicit display corrections. The workbook ships inconsistent
// spellings vs the live site (tervina-eg.com); these are applied at render
// time only and never written back to the DB key.
const DISPLAY_OVERRIDES = {
  [normKey('الاقصر')]: '\u0627\u0644\u0623\u0642\u0635\u0631', // الأقصر
  [normKey('الاسكندرية')]: '\u0627\u0644\u0625\u0633\u0643\u0646\u062F\u0631\u064A\u0629', // الإسكندرية
  // NOTE: Ismailia is deliberately NOT overridden. The workbook ships the no-hamza spelling and we ship it as-is (2026-10 decision); an earlier entry here keyed on a doubled-seen typo and could never match.
  [normKey('اسوان')]: '\u0623\u0633\u0648\u0627\u0646', // أسوان
  [normKey('اسيوط')]: '\u0623\u0633\u064A\u0648\u0637', // أسيوط
}

// ---- Block 1: governorates (col A = master list) ----
const masterCol = 'A'
const master = []
for (let r = 2; r <= 52; r++) {
  const v = at(masterCol, r)
  if (v) master.push({ row: r, raw: v, name: clean(v) })
}

// city blocks = every other column whose row-1 cell is a non-empty value
const cols = [...grid.keys()]
const blocks = []
for (const col of cols) {
  const header = at(col, 1)
  if (!header || header === 'المحافظة') continue
  if (col === masterCol) continue
  const cities = []
  for (let r = 2; r <= 52; r++) {
    const v = at(col, r)
    if (v) cities.push(clean(v))
  }
  if (cities.length) blocks.push({ col, rawHeader: header, name: clean(header), cities })
}

// ---- Block 2: product taxonomy (rows 53..60) ----
const COLS = [...'ABCDEFGHI']
const taxonomyHeaders = {}
for (const col of COLS) taxonomyHeaders[col] = at(col, 53)

const itemTypeCol = COLS.find((c) => taxonomyHeaders[c]?.includes('نوع الصنف'))
const capacityCol = COLS.find((c) => taxonomyHeaders[c]?.includes('القدرة'))
const warrantyCol = COLS.find((c) => taxonomyHeaders[c]?.includes('الضمان'))
const regionCol = cols.filter((c) => at(c, 53) && at(c, 54) && !COLS.includes(c))

const itemTypes = []
for (let r = 54; r <= 70; r++) {
  const v = at(itemTypeCol, r)
  if (v) itemTypes.push({ raw: v, name: clean(v) })
}

// product-type columns are every column between itemTypeCol and capacityCol
const idx = (c) => COLS.indexOf(c)
const productCols = COLS.filter((c) => idx(c) > idx(itemTypeCol) && idx(c) < idx(capacityCol))

// Product-list overrides where the client's warranty mapping disagrees with the
// workbook. Spelling/terminology still comes from the workbook (client directive).
const PRODUCT_OVERRIDES = {
  'طلمبات اعماق': ['فاما', 'ترفينا'],
}
const overrideNotes = []
const productTypesByItem = productCols.map((col) => {
  let items = []
  for (let r = 54; r <= 70; r++) {
    const v = at(col, r)
    if (v) items.push(clean(v))
  }
  // Client directive: the warranty mapping lists طلمبات اعماق as فاما + ترفينا,
  // which differs from the workbook (فاما · ماتريكس · رافيلو · رودلف). The
  // message wins for the PRODUCT LIST; the workbook wins for SPELLING.
  if (PRODUCT_OVERRIDES[clean(taxonomyHeaders[col])]) {
    const override = PRODUCT_OVERRIDES[clean(taxonomyHeaders[col])]
    if (JSON.stringify(override) !== JSON.stringify(items)) {
      overrideNotes.push(
        `  OVERRIDE "${clean(taxonomyHeaders[col])}": workbook [${items.join(' · ')}] -> message [${override.join(' · ')}]`,
      )
    }
    items = override
  }
  return { parentRaw: taxonomyHeaders[col], parent: clean(taxonomyHeaders[col]), items }
})

const simple = (col) => {
  const out = []
  for (let r = 54; r <= 70; r++) {
    const v = at(col, r)
    if (v) out.push(clean(v))
  }
  return out
}

// ---- report ----
const L = []
L.push('=================== GOVERNORATES (master list, column A) ===================')
L.push(`count = ${master.length}`)
master.forEach((g, i) => L.push(`  ${String(i + 1).padStart(2)}. ${g.name}`))

L.push('')
L.push('=================== CITY BLOCKS (header in row 1) ===================')
L.push(`count = ${blocks.length}`)
let total = 0
for (const b of blocks) {
  total += b.cities.length
  L.push(`  ${b.name.padEnd(22)} [col ${b.col.padEnd(2)}] -> ${b.cities.length} cities`)
}
L.push(`  TOTAL CITIES = ${total}`)

L.push('')
L.push('--- master entries with NO matching city block ---')
const byKey = new Map()
const fuzzyJoins = []
for (const b of blocks) {
  const k = normKey(b.name)
  if (!byKey.has(k)) byKey.set(k, [])
  byKey.get(k).push(b)
}
for (const g of master) {
  if (!byKey.has(normKey(g.name))) L.push(`  MISSING BLOCK: ${g.name}`)
  else {
    const b = byKey.get(normKey(g.name))[0]
    if (b.name !== g.name)
      fuzzyJoins.push(`  fuzzy-joined: master "${g.name}"  <->  block "${b.name}" (col ${b.col})`)
  }
}
L.push('--- city blocks with NO matching master entry ---')
const masterNames = new Set(master.map((g) => normKey(g.name)))
for (const b of blocks) if (!masterNames.has(normKey(b.name))) L.push(`  ORPHAN BLOCK: ${b.name} [${b.col}]`)
L.push('')
L.push('--- governorates whose city list is EMPTY after join ---')
for (const g of master) {
  const b = byKey.get(normKey(g.name))?.[0]
  if (!b || b.cities.length === 0) L.push(`  !! ${g.name} -> 0 cities`)
}
L.push('--- display overrides applied ---')
for (const [k, v] of Object.entries(DISPLAY_OVERRIDES)) L.push(`  ${k} -> ${v}`)
L.push('--- fuzzy joins (spelling differed between master list and block header) ---')
fuzzyJoins.forEach((x) => L.push(x))

L.push('')
L.push('=================== PRODUCT TAXONOMY (rows 53-60) ===================')
L.push(`item type column    = ${itemTypeCol}  (${taxonomyHeaders[itemTypeCol]})`)
L.push(`capacity column     = ${capacityCol}  (${taxonomyHeaders[capacityCol]})`)
L.push(`warranty column     = ${warrantyCol}  (${taxonomyHeaders[warrantyCol]})`)
L.push(`region columns      = ${regionCol.join(', ') || 'none found'}`)
L.push('')
L.push(`--- نوع الصنف (${itemTypes.length} options) ---`)
itemTypes.forEach((t, i) => L.push(`  ${i + 1}. ${t.name}`))
L.push('')
L.push('--- نوع المنتج  (CASCADING: depends on نوع الصنف) ---')
productTypesByItem.forEach((p, i) => {
  L.push(`  [${i + 1}] parent "${p.parent}" -> ${p.items.length} options`)
  p.items.forEach((x) => L.push(`        - ${x}`))
})
L.push('')
L.push(`--- القدرة (${simple(capacityCol).length} options) ---`)
L.push('  ' + JSON.stringify(simple(capacityCol)))
L.push('')
L.push(`--- الضمان بالشهر (${simple(warrantyCol).length} options) ---`)
L.push('  ' + JSON.stringify(simple(warrantyCol)))
L.push('')
L.push('--- regions ---')
for (const c of regionCol) {
  const vals = []
  for (let r = 53; r <= 70; r++) {
    const v = at(c, r)
    if (v) vals.push(clean(v))
  }
  if (vals.length > 1) L.push(`  [${c}] ` + JSON.stringify(vals))
}

const report = L.join('\n')
mkdirSync(OUT_DATA, { recursive: true });
writeFileSync(join(WORK, 'report.txt'), report, 'utf8')

// ---- emit TS data ----
// ---------------------------------------------------------------------------
// NOT in the workbook. The sheet ships 25 governorates; tervina-eg.com lists 27
// (north + south Sinai missing) — a customer there could not activate a warranty.
// Sourced from the official governorate portals (northsinai.gov.eg,
// southsinai.gov.eg) + CAPMAS, verified 2026-10-01.
// ---------------------------------------------------------------------------
const SUPPLEMENT = [
  {
    name: 'شمال سيناء',
    cities: ['العريش', 'الحسنة', 'الشيخ زويد', 'بئر العبد', 'رفح', 'نخل'],
  },
  {
    name: 'جنوب سيناء',
    cities: ['الطور', 'شرم الشيخ', 'دهب', 'نويبع', 'طابا', 'أبو زنيمة', 'أبو رديس', 'رأس سدر', 'سانت كاترين'],
  },
]
const supplementCities = SUPPLEMENT.reduce((n, s) => n + s.cities.length, 0)
const grandTotal = total + supplementCities

const q = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
const govs = [
  ...master.map((g) => {
    const b = byKey.get(normKey(g.name))?.[0]
    const cities = b ? b.cities : []
    const display = DISPLAY_OVERRIDES[normKey(g.name)] ?? g.name
    return `  { name: ${q(display)}, cities: [${cities.map(q).join(', ')}] }`
  }),
  ...SUPPLEMENT.map((s) => `  { name: ${q(s.name)}, cities: [${s.cities.map(q).join(', ')}] }`),
].join(',\n')
const overridden = master.filter((g) => DISPLAY_OVERRIDES[normKey(g.name)]).length

const ts = `// AUTO-GENERATED from "Last Update 2026.xlsx" -> sheet "code" (rows 1-52)
// Do not hand-edit. Regenerate with: node tools/gen-data.mjs
// '_' in the source sheet is rendered as a space.
// ${master.length + SUPPLEMENT.length} governorates, ${grandTotal} cities.
// ${overridden} display spellings normalised to match tervina-eg.com.

export type Governorate = {
  /** display name; also the value persisted in the DB */
  name: string
  /** centers / cities within this governorate */
  cities: string[]
}

export const GOVERNORATES: readonly Governorate[] = [
${govs},
] as const

export const GOVERNORATE_NAMES: readonly string[] = GOVERNORATES.map((g) => g.name)

export function citiesOf(governorate: string): readonly string[] {
  return GOVERNORATES.find((g) => g.name === governorate)?.cities ?? []
}
`
writeFileSync(join(OUT_DATA, 'governorates.ts'), ts, 'utf8')

const pt = productTypesByItem.map(
  (p) => `  [${q(p.parent)}]: [${p.items.map(q).join(', ')}]`,
).join(',\n')

const ptTs = `// AUTO-GENERATED from "Last Update 2026.xlsx" -> sheet "code" (rows 53-60)
// Do not hand-edit. Regenerate with: node tools/gen-data.mjs

/** نوع الصنف - top level category */
export const ITEM_TYPES = [
${itemTypes.map((t) => `  ${q(t.name)},`).join('\n')}
] as const
export type ItemType = (typeof ITEM_TYPES)[number]

/**
 * نوع المنتج - CASCADING. Options depend on the selected نوع الصنف.
 * A flat list is WRONG here; see PROJECT_MAP.md [DECISIONS LOCKED].
 */
export const PRODUCT_TYPES_BY_ITEM: Record<ItemType, readonly string[]> = {
${pt},
}

/** القدرة - independent of item/product type */
export const CAPACITIES = ${JSON.stringify(simple(capacityCol))} as const

/** الضمان بالشهر - from the sheet, NOT part of the v1 wizard (see ORPHANS O1) */
export const WARRANTY_MONTHS = ${JSON.stringify(simple(warrantyCol).map((x) => Number(x)))} as const

export function productTypesFor(item: string): readonly string[] {
  return PRODUCT_TYPES_BY_ITEM[item as ItemType] ?? []
}
`
writeFileSync(join(OUT_DATA, 'productOptions.ts'), ptTs, 'utf8')

// Machine-readable taxonomy so downstream tooling (warranty resolution,
// verification, tests) consumes the SAME parsed data instead of a hand copy.
const taxonomy = {
  itemTypeCol,
  capacityCol,
  itemTypes: productTypesByItem.map((g) => g.parent),
  capacities: simple(capacityCol),
  productTypesByItem,
  overrideNotes,
}
writeFileSync(
  join(WORK, 'taxonomy.json'),
  JSON.stringify(taxonomy, null, 2),
  'utf8',
)

console.log(report)

L.push('')
L.push('=================== SUPPLEMENT (not in workbook) ===================')
for (const s of SUPPLEMENT) L.push(`  ${s.name.padEnd(16)} -> ${s.cities.length}: ${s.cities.join(' · ')}`)
L.push(`  SUPPLEMENT CITIES = ${supplementCities}`)
L.push(`  GRAND TOTAL = ${master.length + SUPPLEMENT.length} governorates / ${grandTotal} cities`)
L.push('')
console.log('OK  report.txt governorates.ts productOptions.ts')
console.log(`governorates=${master.length + SUPPLEMENT.length} cities=${grandTotal}`)
console.log(`itemTypes=${itemTypes.length} productCols=${productCols.length} capacities=${simple(capacityCol).length}`)