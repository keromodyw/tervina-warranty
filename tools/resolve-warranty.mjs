// Verifies that every product in the parsed taxonomy resolves to a warranty
// duration, using the durations the client sent in chat (their own spellings)
// bridged onto the workbook spellings. Fails loudly on any gap, and emits the
// warranty_rules seed so the Settings baseline can never drift from this file.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const WORK = join(HERE, '.work')
const TAXONOMY = [
  join(WORK, 'taxonomy.json'),
  join(HERE, '.work', 'xl', 'taxonomy.json'),
].find((p) => existsSync(p))
if (!TAXONOMY) throw new Error('taxonomy.json missing - run `node tools/gen-data.mjs` first')
const taxonomy = JSON.parse(readFileSync(TAXONOMY, 'utf8'))

// ---- the client's warranty mapping -----------------------------------------
// Item types use WORKBOOK spelling (directive: terminology as in the sheet).
// Product terms deliberately keep the CLIENT's spelling so the bridge is tested.
const CLIENT_WARRANTY = {
  'طلمبات ايطالى تحضير': {
    'فاما': 84,
    'ماتريكس': 84,
    'رافيلو': 84,
    'رولدف': 36,
    'فينوكس': 36,
  },
  'طلمبات صينى تحضير': {
    'ترفينا': 24,
    'ترفينا_برمير': 24,
    'ميرو': 12,
    'ميرو _برمير': 12,
    'كيرمينا': 12,
    'كيرمينا_برمير': 12,
    'فرندس': 12,
  },
  'طلمبات اعماق': { 'فاما': 60, 'ترفينا': 60 },
  'طلمبات غاطس': { 'فاما': 60, 'ترفينا': 60 },
  'حمايه': { 'خزان تيوبلس 19 لتر': 12, 'خزان تيوبلس 24 لتر': 18 },
  'سباحه': { scp: null, sbp: null, lp: null, vmax: null },
}

// --------------------------------- matching --------------------------------
// Confirmed equivalences (2026-10-01). The client confirmed each of these pairs
// is "the same thing", so they are declared here as business data rather than
// left to a distance heuristic. Fuzzy matching stays below as a safety net.
const ALIASES = {
  'رولدف': 'رودلف',
  'ترفينا_برمير': 'ترفينا بريمير',
  'ميرو _برمير': 'ميرو بريمير',
  'كيرمينا_برمير': 'كرمينا بريمير',
  'خزان تيوبلس 19 لتر': 'خزان تيوبلس 19لتر',
}
const usedAliases = new Set()

const FOLD = [
  ['[أإآٱ]', 'ا'], ['ى', 'ي'], ['ؤ', 'و'], ['ئ', 'ي'], ['ة', 'ه'],
  ['گ', 'ك'], ['ڭ', 'ك'], ['چ', 'ج'], ['ک', 'ك'], ['ی', 'ي'], ['ھ', 'ه'],
]
const norm = (s) => {
  let out = String(s).replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
  for (const [re, ch] of FOLD) out = out.replace(new RegExp(re, 'g'), ch)
  return out
}

const damerau = (a, b) => {
  const A = [...a], B = [...b]
  if (A.length === 0) return B.length
  if (B.length === 0) return A.length
  const d = Array.from({ length: A.length + 1 }, (_, i) =>
    Array.from({ length: B.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  for (let i = 1; i <= A.length; i++)
    for (let j = 1; j <= B.length; j++) {
      const cost = A[i - 1] === B[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && A[i - 1] === B[j - 2] && A[i - 2] === B[j - 1])
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1) // transposition
    }
  return d[A.length][B.length]
}

// word-wise so a long product name can't drift wholesale
const despaced = (s) => norm(s).replace(/\s+/g, '')
const wordSimilarity = (a, b) => {
  const A = norm(a).split(' '), B = norm(b).split(' ')
  if (A.length !== B.length) return Infinity
  let total = 0
  for (let i = 0; i < A.length; i++) {
    total += damerau(A[i], B[i])
    if (total > 2 * (i + 1)) return Infinity
  }
  return total
}

function resolveProduct(clientTerm, workbookTerms) {
  if (workbookTerms.includes(clientTerm)) return { term: clientTerm, via: 'exact' }
  // declared equivalence wins, but only if the target really exists here
  const aliased = ALIASES[clientTerm]
  if (aliased) {
    if (!workbookTerms.includes(aliased))
      throw new Error(`alias "${clientTerm}" -> "${aliased}" but that product is not in this item type`)
    usedAliases.add(clientTerm)
    return { term: aliased, via: 'alias' }
  }
  const n = norm(clientTerm)
  const folded = workbookTerms.find((t) => norm(t) === n)
  if (folded) return { term: folded, via: 'folded' }
  // Arabic spacing drift: "خزان تيوبلس 19 لتر" vs "خزان تيوبلس 19لتر"
  const tight = despaced(clientTerm)
  const spaced = workbookTerms.find((t) => despaced(t) === tight)
  if (spaced) return { term: spaced, via: 'despaced' }
  let best = { term: null, score: Infinity }
  for (const t of workbookTerms) {
    const s = Math.min(wordSimilarity(clientTerm, t), damerau(tight, despaced(t)))
    if (s < best.score) best = { term: t, score: s }
  }
  if (best.term && best.score <= 2) return { term: best.term, via: `fuzzy(d=${best.score})` }
  return { term: null, via: `UNRESOLVED(d=${best.score})` }
}

// ---------------------------------- run -----------------------------------
const rows = []
const problems = []
let total = 0, resolved = 0, fuzzy = 0, nullDuration = 0

for (const group of taxonomy.productTypesByItem) {
  const clientRow = CLIENT_WARRANTY[group.parent]
  if (!clientRow) {
    problems.push(`item type has no client mapping at all: "${group.parent}"`)
    continue
  }
  // client term -> canonical workbook term
  const canonical = new Map()
  for (const [clientTerm, months] of Object.entries(clientRow)) {
    const r = resolveProduct(clientTerm, group.items)
    if (!r.term) {
      problems.push(`"${group.parent}": client term "${clientTerm}" matches nothing`)
      continue
    }
    if (canonical.has(r.term)) {
      problems.push(
        `"${group.parent}": "${r.term}" claimed by both "${canonical.get(r.term).from}" and "${clientTerm}"`,
      )
      continue
    }
    canonical.set(r.term, { months, via: r.via, from: clientTerm })
  }
  // every workbook product must end up with a duration
  for (const product of group.items) {
    total++
    const hit = canonical.get(product)
    if (!hit) {
      problems.push(`"${group.parent}" / "${product}" -> no duration in client mapping`)
      rows.push({
        item: group.parent,
        product,
        months: 'MISSING',
        via: 'no match',
        flag: 'X',
      })
      continue
    }
    resolved++
    if (hit.via.startsWith('fuzzy')) fuzzy++
    const isNull = hit.months === null || hit.months === 0
    if (isNull) nullDuration++
    rows.push({
      item: group.parent,
      product,
      months: isNull ? null : hit.months,
      via: hit.via === 'exact' ? 'exact' : `${hit.via} <- "${hit.from}"`,
      flag: hit.via === 'exact' ? ' ' : '~',
    })
  }
  // and the mapping must not invent products the workbook doesn't have
  for (const [product] of canonical)
    if (!group.items.includes(product))
      problems.push(`"${group.parent}": mapping produced unknown product "${product}"`)
}

// --------------------------------- report ---------------------------------
const pad = (s, n) => String(s).padEnd(n)
console.log('\n  WARRANTY RESOLUTION  (workbook spelling -> client duration)\n')
console.log(`  ${pad('item type', 26)}${pad('product', 24)}${pad('months', 16)}match`)
console.log(`  ${'-'.repeat(74)}`)
for (const r of rows)
  console.log(
    `  ${r.flag}${pad(r.item, 25)}${pad(r.product, 24)}${pad(
      r.months === null ? 'NULL (none yet)' : r.months,
      16,
    )}${r.via}`,
  )

console.log(`\n  products: ${total}   resolved: ${resolved}   fuzzy: ${fuzzy}   no-duration: ${nullDuration}`)
console.log(`  item types: ${taxonomy.itemTypes.length}   capacities: ${taxonomy.capacities.length}`)
console.log('\n  declared equivalences applied:')
for (const [from, to] of Object.entries(ALIASES))
  console.log(`   ${usedAliases.has(from) ? 'v' : '!'}  ${from}  ->  ${to}${usedAliases.has(from) ? '' : '   UNUSED - stale alias'}`)
const stale = Object.keys(ALIASES).filter((k) => !usedAliases.has(k))
if (stale.length) {
  console.log(`\n  STALE ALIASES (${stale.length}): no client term used these any more`)
  process.exitCode = 1
}
if (taxonomy.overrideNotes.length) {
  console.log('\n  product-list overrides applied:')
  for (const n of taxonomy.overrideNotes) console.log(`   ${n}`)
}
if (problems.length) {
  console.log(`\n  FAILURES (${problems.length}):`)
  for (const p of problems) console.log(`   X ${p}`)
  process.exitCode = 1
} else {
  console.log('\n  PASS - every product resolves to a duration.')
}

// -------------------------------- seed SQL --------------------------------
// Emitted only on a clean pass: a partial seed would hide the failure behind
// "some rows are just missing a duration".
if (!problems.length) {
  const lit = (s) => `'${String(s).replace(/'/g, "''")}'`
  const seed = [
    '-- AUTO-GENERATED by tools/resolve-warranty.mjs - do not hand-edit.',
    '-- Baseline for the admin Settings tab (D22). Durations are snapshotted',
    '-- onto each claim at submit (D25), so editing a row here never rewrites',
    '-- an issued certificate.',
    '',
    'insert into warranty_rules (item_type, product_type, warranty_months) values',
    rows
      .map(
        (r, i) =>
          `  (${lit(r.item)}, ${lit(r.product)}, ${r.months === null ? 'NULL' : r.months})${
            i === rows.length - 1 ? '' : ','
          }`,
      )
      .join('\n'),
    // No semicolon on the final row above: ON CONFLICT is part of the same
    // statement. Terminating the VALUES list first makes this a second,
    // standalone statement, which is a syntax error the whole file fails on.
    'on conflict (item_type, product_type) do nothing;',
    '',
  ].join('\n')
  const out = join(HERE, '..', 'supabase', 'seed.sql')
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, seed, 'utf8')
  console.log(`  wrote ${out} (${rows.length} rules)`)

  // The client needs the same baseline before the first Settings edit (and while
  // offline). Emitting it from here - rather than hand-maintaining a parallel
  // list - is what stops the TS fallback and the DB rows from drifting apart.
  //
  // Shape is NESTED, not { [item, product]: months }. A computed key like
  // ['a','b'] is stringified by JS to "a,b", so a lookup joining with '' would
  // never match and every product would resolve to null.
  const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
  const items = []
  for (const r of rows) {
    let bucket = items.find((b) => b.item === r.item)
    if (!bucket) {
      bucket = { item: r.item, products: [] }
      items.push(bucket)
    }
    bucket.products.push(r)
  }
  const ts = [
    '// AUTO-GENERATED by tools/resolve-warranty.mjs - do not hand-edit.',
    '//',
    '// The base layer for warranty resolution. Deliberately the same source as',
    '// supabase/seed.sql, which is what makes the D22 fallback chain trustworthy:',
    '//   DB row -> this baseline -> null',
    '// A null here is intentional, not missing data (e.g. السباحة).',
    '',
    'export const WARRANTY_BASE = {',
    ...items.flatMap((b) => [
      `  ${q(b.item)}: {`,
      ...b.products.map(
        (p) => `    ${q(p.product)}: ${p.months === null ? 'null' : p.months},`,
      ),
      '  },',
    ]),
    '} as const satisfies Record<string, Record<string, number | null>>',
    '',
  ].join('\n')
  const tsOut = join(HERE, '..', 'src', 'core', 'warranty', 'base.ts')
  mkdirSync(dirname(tsOut), { recursive: true })
  writeFileSync(tsOut, ts, 'utf8')
  console.log(`  wrote ${tsOut} (${rows.length} rules, ${items.length} item types)`)
}