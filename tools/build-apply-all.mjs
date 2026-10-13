// Builds supabase/APPLY-ALL.sql - the single-paste script for the Supabase SQL
// Editor - from supabase/migrations/*.sql plus supabase/seed.sql.
//
// Why this exists: APPLY-ALL.sql used to be assembled by hand, and a careless
// PowerShell round-trip (Get-Content without -Encoding utf8, then Set-Content)
// silently re-encoded its Arabic to mojibake - the file ended up with zero valid
// Arabic bytes. Every Arabic literal in it (sector and product names, the
// Arabic-Indic digit ranges in normalize_phone) would have been garbage in the
// database. It also drifted out of sync with the migrations it copies.
//
// Node reads and writes UTF-8 by default, so this cannot happen here. Run it
// after any migration or seed change:  node tools/build-apply-all.mjs

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SUPABASE = join(HERE, '..', 'supabase')

const header = `-- ============================================================
-- TERVINA WARRANTY - APPLY EVERYTHING, IN THIS ORDER
-- Paste the WHOLE file into Supabase Dashboard -> SQL Editor -> Run.
--
-- Concatenation of supabase/migrations/* + supabase/seed.sql.
-- migrations/ stays the source of truth for supabase db reset.
--
-- DO NOT EDIT BY HAND. Regenerate with:  node tools/build-apply-all.mjs
-- ============================================================`

const migrations = readdirSync(join(SUPABASE, 'migrations'))
  .filter((f) => f.endsWith('.sql'))
  .sort()

const sources = [
  ...migrations.map((f) => ['migrations', f]),
  ['', 'seed.sql'],
]

const parts = [header]
for (const [sub, file] of sources) {
  const rel = sub ? `supabase\\${sub}\\${file}` : `supabase\\${file}`
  const body = readFileSync(join(SUPABASE, sub, file), 'utf8').trimEnd()
  parts.push(`-- ---------- BEGIN ${rel} ----------\n${body}`)
}

const out = parts.join('\n\n') + '\n'
const dest = join(SUPABASE, 'APPLY-ALL.sql')
writeFileSync(dest, out, 'utf8')

// Guard the exact failure that motivated this script.
if (!/[\u0600-\u06FF]/.test(out) && sources.some(([, f]) => /arabic|seed/i.test(f))) {
  throw new Error('APPLY-ALL.sql lost its Arabic text - refusing to write.')
}
if (/[ØÙÂ][\u0080-\u00BF]/.test(out)) {
  throw new Error('APPLY-ALL.sql contains mojibake - refusing to write.')
}

console.log(`wrote ${dest} (${sources.length} blocks, ${Buffer.byteLength(out)} bytes)`)
