# TERVINA — Warranty Activation (تفعيل ضمان المنتجات)

> Single source of truth for architecture. Update when a milestone closes.
> Last updated: 2026-10-01 · Env: Node 24.18.0 / npm 11.16.0 / git 2.55.0

---

## [DECISIONS LOCKED]

| # | Question | Decision | Rationale |
|---|---|---|---|
| D1 | Identity | **Supabase Anonymous Auth** (`signInAnonymously`) | Real JWT, zero friction, RLS works. Caveat: user lost if localStorage cleared → phone-tracking is the recovery path (D5). |
| D2 | Auto-capture | **Fully automatic shutter** | Fires on sustained sharpness (labels) / successful Code128 decode (bowl). Hard anti-deadlock fallback mandatory. |
| D3 | Language | **Arabic RTL only** | Half the strings, no i18n layer in v1. |
| D4 | Cities | **Major cities only (~150)** | Static JSON in repo. No external API. |
| D5 | Recovery | Track-by-phone is a **first-class feature**, not a fallback | Required by D1's anonymous-user limitation. |
| D6 | Visual fidelity | **Pixel-match `tervina-eg.com/ar/activation`** — palette, Cairo font, Elementor layout | Client directive: "match EVERYTHING". Tokens extracted → see [DESIGN TOKENS]. |
| D7 | Product taxonomy | **نوع المنتج is a CASCADING dropdown**, not a flat list | The workbook proves it: each نوع الصنف owns a private product list. A flat `<select>` would be wrong. |
| D8 | City list | **27 governorates / 274 cities** (workbook's 259 + 15 Sinai) | Workbook supersedes the earlier "≈150 majors" estimate. |
| D9 | Data source of truth | Workbook `code` sheet is canonical. `_`→space, 5 explicit spelling overrides applied at render. | Silent rewriting of client data is unacceptable; overrides are a reviewable table. |
| D10 | Missing governorates | **شمال سيناء (6 centers) + جنوب سيناء (9 cities) added** | Workbook shipped 25; the live site lists 27. Without these, a Sinai customer cannot activate a warranty at all. Sourced from official portals, not guessed. |
| D11 | القدرة | **Flat, 5 values** — no per-item filtering | Confirmed: the sheet is correct. Only `نوع المنتج` cascades. |
| D12 | الضمان بالشهر | **Auto-derived from المنتج** — **locked & verified 22/22** | Resolution ladder + the 5 bridged spellings: see Reference data pipeline. `سباحه` has no duration yet (D22). |
| D13 | Flow | **4 steps, order changed:** Personal → **Product** → **Photos** → **Review** | Product must be picked *before* photos: the photo manifest is conditional on `item_type`. |
| D14 | Photo manifest | **Driven by `item_type`** | `طلمبات … تحضير` → rosetta + bowl + invoice (**3**, confirmed). All other types → single product label + invoice. Invoice is **manual**; label shots are auto. |
| D15 | Submit | Moved to a **dedicated review step** — no submit inside the photo step | Customer must confirm serial + legibility + all data before committing. |
| D16 | Governorate order | **Live-site order, Cairo first** | Not alphabetical. NB: the live site itself omits `البحر الأحمر` — see O14. |
| D17 | القطاع | **Auto-filled** using the **official 7 governorate groups** (`إقليم …`) | The workbook's 4-way list has no per-governorate assignment and omits Canal/Alexandria/Matrouh/Sinai. Mapping locked below. |
| D18 | Serial | **Globally UNIQUE** | Stated goal: "منع التكرار / كشفFRAUD". Hard DB constraint. |
| D19 | Legacy import | Imported rows forced to `reviewed + sent + photos_uploaded = true` | Client directive — they are completed historical orders. |
| D20 | Photo archive | **ZIP**, one folder per `serial` | RAR encoding is impossible open-source (verified). Client: "all I care about is the folder named after the serial". WinRAR/7-Zip open it unchanged. |
| D21 | Uncollected Sheet1 columns | **Exported empty**, wizard unchanged | The 8 legacy-only columns keep their headers so the file stays importable round-trip. |
| D22 | Reference data is editable | **`warranty_rules` table** + a **Settings** tab in admin; the generated TS stays the base layer | `سباحه` has no duration "for now", which means durations must be changeable without a redeploy. Resolution order = DB row → generated base → `null`. |
| D23 | Terminology | **The workbook is authoritative** for all `item_type` / `product_type` strings | Client directive. The chat spelling differs from the sheet in 6 places — the sheet wins everywhere, including Sheet1's `نوع الموتور` (D12). |
| D24 | `طلمبات اعماق` product list | **`فاما · ترفينا`** (overrides the workbook's 4) | Client directive: "take whatever in the message". Applied as an explicit, logged override in the generator — not a silent edit. |
| D25 | Warranty claim snapshots the duration | `warranty_claims.warranty_months` is written at submit and never recomputed | Otherwise editing a duration in Settings would silently rewrite the warranty of every historical certificate. |
| D26 | Serial format | **Digits only** (`/^\d+$/`), stored as `text`, **never parsed as a number** | Client: "a bunch of digits". Digit-only is a strong misread filter — a Code128 misread almost never stays all-numeric. Length bound stays a single tunable constant until real serials are seen. **Never `parseInt`** — a leading-zero serial is a different unit. |
| D27 | Capture framing | **Find the label's 4 white corners, then capture with a margin** | Client spec: square/rect white label; "capture around the label, not tightly just the label". Pipeline + validity gates + margin rule documented under Camera. Replaces sharpness-only framing. |
| D28 | Staff access | **Supabase Auth for identity + a `staff` table for authorisation.** Login by email/password; access granted by row in `staff`. | Client: "add a staff table in the database to add admins". Auth alone can't be edited from a UI; a table alone can't authenticate. This is the only split that gives both. |
| D29 | Deployment | **New domain + new site.** No dependency on `tervina-eg.com`. | Client has no access to the old domain. The reference site is a **design reference only** — branding/domain are ours to set. |

---

## [DESIGN TOKENS]

Extracted from the live page (2026-10-01). Stack is **Kadence theme + Elementor + Cairo**. Reproduce these, do not invent.

| Token | Value | Use |
|---|---|---|
| `--color-primary` | `#2B6CB0` | CTA buttons, active steps, links |
| `--color-primary-dark` | `#215387` | CTA hover |
| `--color-navy` | `#003366` | Header / footer |
| `--color-heading` | `#1A202C` | Titles |
| `--color-body` | `#2D3748` / `#4A5568` / `#718096` | Body text / secondary / muted |
| `--color-surface` | `#FFFFFF` | Cards |
| `--color-surface-alt` | `#EDF2F7` / `#F7FAFC` | Alternating blocks |
| `--color-page` | `#F7F9FC` | Page background |
| `--color-success` | `#13612E` | Valid capture, approved status |
| `--color-danger` | `#B82105` | Errors, rejected status |
| `--color-warning` | `#F7630C` / `#F5A524` | "move closer" / amber states |
| `--color-whatsapp` | `#25D366` | WhatsApp CTA (reference page's only green) |
| `--color-info` | `#1159AF` | Info banners |

**Font:** `Cairo`, weights 400/500/600/700/800 — self-host via `@fontsource/cairo`, never Google CDN (site is Egyptian mobile-first; a blocked Google Fonts request must not break Arabic rendering).

**Reference page structure to reproduce on `/ar/activation`:**
left/right split hero — stepper panel (3 numbered steps + "خطوات مهمة" note card + "VAMA / Italian Technology 🇮🇹" card + "الضمان يشمل" 3-item list) beside the form card "بيانات تفعيل الضمان". Below: support strip (19301), 3 trust badges, footer with link columns.

---

## [TECH_STACK]

Pinned to registry `latest` verified on **2026-10-01**. All are stable GA; nothing deprecated.

| Package | Version | Notes |
|---|---|---|
| `react` / `react-dom` | **19.3.0** | GA 2026-09-09 |
| `react-router` | **8.4.0** | v8 GA 2026-09-15. **Do NOT use `react-router-dom`** — frozen at 7.18.4 (v7-era shim). Import DOM exports from `react-router` directly. |
| `vite` | **8.3.1** | rolldown-based |
| `@vitejs/plugin-react` | **6.1.1** | |
| `typescript` | **7.0.2** | GA (native Go port). Fallback to 6.x if a tooling gap appears. |
| `tailwindcss` + `@tailwindcss/vite` | **4.3.3** | v4 CSS-first config — no `tailwind.config.js` |
| `@supabase/supabase-js` | **2.117.2** | |
| `supabase` (CLI, dev) | **2.119.0** | |
| `zxing-wasm` | **3.1.4** | Import from **`zxing-wasm/reader`** (1.04 MiB wasm, reader-only) |
| `zod` | **4.6.5** | v4 API |
| `react-hook-form` | **7.89.0** | |
| `@hookform/resolvers` | **5.9.1** | |
| `libphonenumber-js` | **1.13.14** | EG E.164 normalization — makes phone the real identity key |
| `sonner` | **2.0.8** | toasts, RTL-aware |
| `clsx` | **2.1.1** | |
| `exceljs` | **4.4.0** | Admin only: Excel export **and** legacy import (one parser, both directions). Avoid `xlsx` 0.18.5 — abandoned SheetJS build on npm. |
| `client-zip` | **2.5.1** | Admin only: photo archive. Tiny, streams, no worker. See **D20** for why ZIP and not RAR. |
| `@fontsource-variable/cairo` | **5.3.0** | Cairo 400–800 variable, **self-hosted** (D6). Static `@fontsource/cairo` 5.3.0 as fallback. |
| `vitest` (dev) | **^5** | Narrow scope: only `sharpness`, `imagePipeline`, `phone`, `barcodeReader`, and a `governorates` integrity test |

### Deliberately dropped (No Feature Creep audit)

| Dropped | Why |
|---|---|
| `@zxing/browser` 0.2.1 | Redundant. We need a **custom frame loop** anyway to score sharpness — a second scanner abstraction would fight ours. |
| `html5-qrcode` 2.3.8 | Same reason; heavier. |
| `qrcode` 1.5.4 | No barcode *generation* needed. |
| `date-fns` | `Intl.DateTimeFormat('ar-EG')` is built in. |
| `dexie` / `idb-keyval` | Draft cache is one small object → `localStorage`. |
| `sharp` | Image resize/compress happens client-side before upload. |
| i18n libraries | D3 (Arabic-only). |
| Zustand/Redux | Wizard draft = one `useReducer` in `useActivationDraft`. |

---

## [SYSTEM_FLOW]

### GUI journey — verifiable goals

```
/ar/activation                      (HomePage)
  ├─ [تفعيل ضمان منتج] ──────────► /ar/activation/new
  │     Step 1 Personal ─► Step 2 Product ─► Step 3 Photos ─► Step 4 Review ─► Success
  └─ [متابعة حالة طلب] ───────────► /ar/activation/track
        └─ phone input ─► list of claims + status

Guard: if localStorage has a draft/claim for this phone,
HomePage shows "متابعة طلبك" (prefilled, zero re-entry).
```

### Step detail (D13 — order changed)

| Step | Fields | Exit condition (verifiable) |
|---|---|---|
| **1 — البيانات الشخصية** | `full_name`, `phone` (WhatsApp), `technician_name`, `technician_phone`, `governorate` (27, site order), `city` (filtered). `sector` is **auto-filled** (D17). | Valid zod → `upsert customers` → **anonymous session created** → payload cached to `localStorage` → advance |
| **2 — بيانات المنتج** | `item_type` ← 5–6 options<br>`product_type` ← **filtered by `item_type`** (cascading)<br>`capacity` ← 5 flat<br>*(`serial` appears here **disabled** — not yet scanned)* | Valid zod incl. cross-field rule → **photo manifest computed from `item_type`** → advance |
| **3 — تصوير اللابلز** | Manifest is conditional (D14). Auto shots use the sharpness/barcode FSM; invoice is **manual**. | All **required** shots quality-passed AND `serial` decoded → advance |
| **4 — المراجعة والإرسال** | Read-only summary of everything + **retake per photo** + serial verification | User confirms → upload → insert claim → Success w/ `reference_code` |

> ### ⚠️ Step 2 is a CASCADING form, not flat selects
> `product_type` options are **owned by** `item_type`. Workbook spellings, per D23. `طلمبات اعماق` is the one overridden list (D24):
>
> | item_type (`نوع الصنف`) | # | product_type options (`نوع الموتور`) |
> |---|---|---|
> | طلمبات ايطالى تحضير | 5 | فاما · ماتريكس · رافيلو · رودلف · فينوكس |
> | طلمبات صينى تحضير | 7 | ترفينا · ترفينا بريمير · ميرو · ميرو بريمير · كيرمينا · كرمينا بريمير · فرندس |
> | طلمبات اعماق | **2** *(override)* | فاما · ترفينا |
> | طلمبات غاطس | 2 | فاما · ترفينا |
> | حمايه | 2 | خزان تيوبلس 19لتر · خزان تيوبلس 24 لتر |
> | سباحه | 4 | scp · sbp · lp · vmax |
>
> **Enforced twice:** UI clears `product_type` when `item_type` changes; zod `.refine()` rejects a mismatched pair server-side too.
> **`capacity` is INDEPENDENT** — always `0.5ح · 1ح · 1.5ح · 2ح · 3ح`, no filtering.

### Conditional photo manifest (D14)

```ts
type PhotoKind = 'rosetta_label' | 'bowl_barcode' | 'product_label' | 'invoice'
type CaptureMode = 'auto' | 'manual'   // per-photo, not per-step

// "تحضير" types = the two water-treatment pumps
const PREPARATION_TYPES: ItemType[] = ['طلمبات مياه ايطالى', 'طلمبات مياه صينى']

function manifestFor(item: ItemType): Shot[] {
  return PREPARATION_TYPES.includes(item)
    ? [                                        // 3 photos — confirmed, was a miscount
        { kind: 'rosetta_label', mode: 'auto',   required: true  },
        { kind: 'bowl_barcode', mode: 'auto',   required: true  },  // Code128 -> serial
        { kind: 'invoice',      mode: 'manual', required: false },
      ]
    : [
        { kind: 'product_label', mode: 'auto',   required: true  },  // Code128 -> serial
        { kind: 'invoice',       mode: 'manual', required: false },
      ]
}
```

`bowl_barcode` and `product_label` both carry the **Code128 → serial**. `invoice` is explicitly **manual + optional** — it bypasses the auto-shutter FSM entirely and must never block.

### ZIP layout (D20)

```
photos.zip
└── <serial>/
    ├── rosetta_label.jpg
    ├── bowl_barcode.jpg
    └── invoice.jpg          (only if captured)
```

`client-zip` 2.5.1 streams this straight from Supabase signed URLs — no temp files, no backend.
> **الضمان بالشهر** (`0,12,18,24,36,60,84`) exists in the sheet but is **not** a v1 wizard field → see O1.

### Data flow (API) — no custom server, Supabase client + RLS only

```
signInAnonymously()            → auth.uid()  ─┐
                                                 │  session cached in localStorage
Step 1: upsert customers       (RLS: own row) ←┤
Step 2: local only (sharpness + zxing-wasm)     │
Step 3: storage.upload ×3  ─► insert claim ─► insert claim_photos
Track:  rpc('track_claims_by_phone', [phone])
```

**Insert ordering rationale:** `claim_id` is a **client-generated UUID**. Photos upload first, DB insert last → a claim can never exist without its photos. Orphaned *storage objects* are cheap and reaped; orphaned *DB claims* are not.

### Camera / auto-capture pipeline (highest-risk component)

```
<video> ─requestVideoFrameCallback─► draw to OffscreenCanvas
                                       │
                ┌──────────────────────┴───────────────────────┐
                ▼                                              ▼
      worker: Variance-of-Laplacian                zxing-wasm readBarcodes
      (grayscale, 160px wide, throttled ~8fps)     {formats:['Code128'], tryHarder:true}
                │                                              │
                ▼                                              ▼
         normalized score 0..1                        decoded text + position
                └──────────────┬───────────────────────────────┘
                               ▼
                    AUTO-FIRE FSM (useImageQuality)
                      score ≥ T sustained K=3 frames
                      AND ≥700ms since last capture
                               ▼
                 capture full-res still → POST-CAPTURE VALIDATION
                       re-score + re-decode the still
                    ┌──────────┴──────────┐
                 PASS                  FAIL → "الصورة مش واضحة، جرب تاني" (retry)
                    ▼
                 accept → next shot
```

**Anti-deadlock rule (D2 must never trap the user):**
1. If no capture fires within `MAX_WAIT_MS`, reveal a manual shutter button.
2. If `getUserMedia` is unavailable/denied (desktop, denied permission, non-HTTPS) → fall back to `<input type="file" accept="image/*" capture="environment">` and run the **identical** score + decode pipeline on the file (with `createImageBitmap(f, {imageOrientation:'from-image'})` for EXFO).
3. `invoice` never auto-fires — it is manual by definition (D14).

### Label quad detection + margin (D27)

The label is a **square or rectangle, white**, held in the hand. So the frame is found from the label's **own 4 bright corners** — not from the barcode, and not from a plain sharpness score.

```
video frame
   ▼  downscale to 240px long edge
grayscale → Otsu threshold (bright = label)
   ▼
largest 4-connected bright component (BFS)
   ▼
boundary trace → Douglas–Peucker simplify → 4 vertices
   ▼  VALIDITY GATES (all must pass)
  · area ≥ 12% of frame          · convex
  · 4 corners, not 3 or 6+       · interior angles 60°–120°
  · min side ≥ 8% of frame       · squareness sane (no needle shapes)
   ▼
scale corners to full-res → EXPAND BY MARGIN → clamp to image bounds
   ▼
capture the expanded region → sharpness + Code128 decode on THAT crop
```

**No OpenCV.js.** It is a ~8 MB wasm download for a job that adaptive threshold + connected components solves in ~250 lines of dependency-free TS — and it keeps the highest-risk component unit-testable with synthetic frames.

**Margin (D27, explicit client requirement: "capture around the label, not tightly just the label").**
- Expand outward by `margin = clamp(0.12 × labelWidth, 28px, 90px)` at full resolution, applied on all four sides.
- The label's own white border plus this margin means the crop still contains surrounding context — which is what makes the photo usable as warranty evidence later, not just as a barcode source.
- **Too-close rule:** if more than ~8% of any edge of the expanded quad falls outside the frame, **do not capture**. Show "قرّب الالتقاط شوية" and keep scanning. A half-out-of-frame label yields a serial that decodes fine but a photo nobody can adjudicate.

**Fallback ladder** (never a dead end): quad detection → barcode-derived quad from zxing's `position` corners, expanded by the same margin → manual shutter. A label we cannot outline is still photographable.

**Perspective rectification** (bilinear warp of the quad to a rectangle) is a stretch goal inside M5 — the quad already exists, and it measurably improves decode rate on angled shots. Cut it if it threatens the M5 gate; margin + sharpness alone still pass.

---

## [LEGACY SCHEMA — Sheet1]

`Last Update 2026.xlsx` → `Sheet1` = **header row only**, 23 columns A→W, 4017 empty formatted rows. This is the client's existing warranty ledger and drives **both** the Excel export and the legacy import.

| # | Col | Header | In new wizard? |
|---|---|---|---|
| 1 | A | كود التفعيله | generated — `reference_code` |
| 2 | B | سريال الماتور | ✅ `serial` |
| 3 | C | بدايه الضمان | computed — submit date |
| 4 | D | مده الضمان | ✅ derived (`warranty_months`) |
| 5 | E | نهايه الضمان | computed — start + duration |
| 6 | F | نوع الصنف | ✅ `item_type` |
| 7 | G | **نوع الموتور** | ✅ `product_type` — the sheet's name is used **verbatim** in the UI too (D23) |
| 8 | H | القدرة | ✅ `capacity` |
| 9 | I | كود الفنى | ❌ not collected |
| 10 | J | اسم الفني | ✅ `technician_name` |
| 11 | K | رقم التليفون *(technician)* | ✅ `technician_phone` |
| 12 | L | **الرقم القومي** | ❌ not collected — national ID |
| 13 | M | **صورة البطاقة** | ❌ not collected — ID photo |
| 14 | N | اسم المالك | ✅ `full_name` |
| 15 | O | رقم التليفون *(owner)* | ✅ `phone` |
| 16 | P | المحافظة | ✅ `governorate` |
| 17 | Q | المركز | ✅ `city` |
| 18 | R | **القطاع** | ✅ auto-filled (D17) |
| 19 | S | **اسم التاجر** | ❌ not collected — dealer |
| 20 | T | **رقم التليفون** *(dealer)* | ❌ not collected |
| 21 | U | بصوره | ⚠️ ambiguous — see B16 |
| 22 | V | اسم الموظف | ❌ admin-side only |
| 23 | W | ملاحظات | `notes` (admin + customer) |

**8 of 23 columns are never populated by the new flow** — `I`, `L`, `M`, `S`, `T`, `U`, `V`, and `كود الفنى`. **Resolved: export them empty** (D21), wizard unchanged. Import still reads them when present, so legacy files round-trip.

---

## [ADMIN PANEL]

Separate section under `/admin`, **not** reachable from the public nav. Staff-only.

### Auth (B18)
Anonymous auth (D1) is for customers. Staff need real accounts. Two options — see B18. Either way it is a **separate Supabase user role**, enforced by RLS, never a client-side check.

### Screen 1 — الإحصائيات (dashboard)
Needs a definition from the client (**B19**). Proposed default, all derivable from `warranty_claims` with no extra schema:

| Card | Metric |
|---|---|
| إجمالي الطلبات | `count(*)` |
| قيد المراجعة | `status = pending_review` |
| تمت الموافقة | `status = approved` |
| مرفوضة | `status = rejected` |
| تم الإرسال للعميل | `sent_to_customer = true` |
| الصور مرفوعة | `photos_exported = true` |
| طلبات اليوم / الشهر | date buckets |
| توزيع حسب نوع الصنف | group by `item_type` |
| توزيع حسب القطاع | group by `sector` (D17) |
| توزيع حسب المحافظة | group by `governorate` |

### Screen 2 — مراجعة الطلبات (orders table)

- Compact **closed rows** with expand-on-click; per-row **status indicators**.
- **Filter:** `pending_review` / `approved` / `rejected` / `sent` / `photos exported`.
- **Search:** one box across `full_name`, `phone`, `serial` (OR semantics, trimmed, debounced).
- **Three per-order checks:**

| Check | Rule | Effect |
|---|---|---|
| **مراجعة** | Admin approves or declines. | `approved` / `rejected`. Declined ⇒ **ignored everywhere** (stats, exports, WhatsApp, photo bundle). |
| **إرسال للعميل** | Button **enabled only when `status = approved`.** Opens `https://wa.me/<phone>?text=<encoded template>`. | On click ⇒ `sent_to_customer = true` (D: "if opened then TRUE"). |
| **الإعدادات** | **New 4th tab** (D22). Grid of `item_type × product_type` → editable `warranty_months`. Empty = `null`. Save per row. Staff-only, enforced in RLS. |
| **رفع الصور** | **Bulk toolbar button**, not per-row. Selects `approved AND photos_exported = false`. | **ZIP (D20)** = one folder per `serial`, each holding that claim's photos. Sets `photos_exported = true`. |

> **Why ZIP, not RAR — resolved (D20).** RAR **encoding does not exist in open source.** Verified 2026-10-01 on npm: `node-rar` 0.0.2, `rarfile` 0.2.3-1, `unrar` 0.2.0 are all **extract-only**; `rar` is a 0.0.0 placeholder. No WASM encoder exists. A real `.rar` would need the proprietary `rar.exe` CLI, i.e. a server — contradicting the "React + Supabase, no backend" plan. Client accepted ZIP; WinRAR and 7-Zip open it unchanged.

### WhatsApp message template (verbatim, `%` placeholders)

```
عزيزنا العميل / .........
يسعدنا إبلاغك أنه قد تم تفعيل الضمان الخاص ب ..........
برقم سيريال ........ و أن رقم الضمان........
و تاريخ التفعيل ...... و و لمده .........
حيث ينتهي الضمان بتاريخ .........
و نتمنى لكم يوماً سعيداً.

برجاء عدم الرد على هذه الرسالة. في حالة وجود أي استفسارات، يُرجى التواصل مع خدمة العملاء على الرقم 19301
```

> **Note:** the client's text contains a doubled `و و` before `لمده`. Kept **verbatim** unless they say otherwise — flagged as B21.

### Bulk toolbar

| Button | Behaviour |
|---|---|
| **رفع الصور** | `approved AND photos_exported = false` → ZIP, one folder per `serial` (D20). |
| **تحميل اكسيل** | Modal: `الكل` / `فترة معينة` (date range) / `انهاردة`. Emits `.xlsx` with the **exact 23-column Sheet1 structure** in A→W order, rows populated from claims, sorted by activation code. Needs `exceljs` 4.4.0 (write + styling) — `xlsx` 0.18.5 is unmaintained on npm. |
| **رفع بيانات قديمة** | Upload `.xlsx` with the same structure → import. Each row forced to `reviewed + sent_to_customer + photos_exported = true` (D19). Serial uniqueness enforced (D18) so the import doubles as the **fraud/duplicate baseline**. Needs the same parser as the export — write once, use twice. |

**Deliberate constraint:** no new backend. Everything above runs in the admin browser against Supabase (staff RLS + Storage signed URLs). D20 removed the only feature that would have broken that.

### References — locked tables

**`sector` — official 7 Egyptian governorate groups (D17).** Auto-filled from `governorate`; covers all 27.

| Sector | Governorates |
|---|---|
| إقليم القاهرة | القاهرة · الجيزة · القليوبية |
| إقليم الإسكندرية | الإسكندرية · البحيرة · مطروح |
| إقليم الدلتا | الدقهلية · كفر الشيخ · الغربية · المنوفية · دمياط |
| إقليم القناة | بورسعيد · الإسماعيلية · السويس · الشرقية · شمال سيناء · جنوب سيناء · **البحر الأحمر** |
| إقليم شمال الصعيد | بني سويف · المنيا · الفيوم |
| إقليم وسط الصعيد | أسيوط · الوادي الجديد |
| إقليم جنوب الصعيد | سوهاج · قنا · الأقصر · أسوان |

= 3+3+5+7+3+2+4 = **27**, no gaps. Unit test asserts exactly this.

**Photo archive (D20).** ZIP, one folder per `serial`. Only `approved AND photos_exported = false`.

**Excel (D21).** All 23 Sheet1 headers emitted in A→W order; the 8 legacy-only columns (`I`, `L`, `M`, `S`, `T`, `U`, `V`, and `كود الفنى`) are written **empty**. Round-trip is safe because import reads by header name, not position.

---

## [ARCHITECTURE]

Feature-first (domain-driven). A `core/` layer exists **only** for logic genuinely repeated across features or too heavy for a component.

```
D:\Tervina Group\
├─ PROJECT_MAP.md
├─ index.html  vite.config.ts  tsconfig.json  .env.example
├─ supabase/
│  ├─ config.toml                    # [auth] enable_anonymous_sign_ins = true
│  ├─ migrations/
│  │  ├─ 20261001000001_schema.sql
│  │  ├─ 20261001000002_rls.sql
│  │  └─ 20261001000003_rpc.sql
│  └─ seed.sql                       # reference data — GENERATED by resolve-warranty.mjs
├─ tools/
│  ├─ gen-data.mjs                   # workbook → src/data/*.ts  (idempotent, committed)
│  └─ resolve-warranty.mjs           # durations → canonical terms + warranty_rules seed
└─ src/
   ├─ main.tsx
   ├─ app/            App.tsx · router.tsx · shell/AppShell.tsx (RTL, header, footer)
   ├─ features/
   │  ├─ home/        HomePage.tsx                      # the two buttons
   │  ├─ activation/  ActivationPage.tsx                # 4-step wizard orchestrator
   │  │  ├─ steps/    PersonalStep · ProductStep · PhotoStep · ReviewStep · SuccessStep
   │  │  ├─ useActivationDraft.ts
   │  │  └─ photoManifest.ts                          # D14: item_type -> photo list
   │  ├─ tracking/    TrackPage.tsx
   │  └─ admin/       AdminLayout.tsx                   # staff gate (B18)
   │     ├─ stats/    StatsPage.tsx · useStats.ts
   │     ├─ orders/   OrdersPage.tsx · OrderRow.tsx · useOrderFilters.ts
   │     │            useReviewAction.ts · useSendWhatsApp.ts
   │     ├─ settings/ SettingsPage.tsx · useWarrantyRules.ts   # D22
   │     ├─ staff/    StaffPage.tsx · useStaff.ts              # D28
   │     └─ bulk/     usePhotoArchive.ts · useExcelExport.ts
   │                  useLegacyImport.ts · LegacySheet.ts   # one 23-col mapping, both ways
   ├─ core/
   │  ├─ supabase/    client.ts · database.types.ts · staff.ts
   │  ├─ camera/      CameraCapture.tsx · useImageQuality.ts (FSM)
   │  │               sharpness.worker.ts · imagePipeline.ts · labelQuad.ts
   │  ├─ barcode/     barcodeReader.ts
   │  ├─ session/     session.ts        # anon auth + localStorage draft
   │  ├─ reference/   sector.ts         # gov -> القطاع (D17)
   │  │               warrantyMap.ts    # DB rule -> fallback to generated base (D22)
   │  └─ lib/         phone.ts · logger.ts · cn.ts · whatsapp.ts
   ├─ data/           governorates.ts · productOptions.ts   # BOTH GENERATED — do not hand-edit
   └─ ui/             controls.tsx · feedback.tsx · Stepper.tsx
```

### Reference data pipeline

`Last Update 2026.xlsx` → sheet `code` → `tools/gen-data.mjs` → `src/data/*.ts`

The workbook has two unrelated blocks; the generator reads both:

| Rows | Content | Extraction rule |
|---|---|---|
| 1–52 | **Location.** Col A = 25 governorates. Every *other* non-empty column in row 1 is a governorate header whose column below holds its cities (D/K/X/Y/AB are blank spacers). | Join master→block on an **Arabic-insensitive key** (`أإآ→ا`, `ة→ه`, `ؤئى→ي`, strip tashkeel). Needed: master has `أسوان`/`أسيوط` but block headers say `اسوان`/`اسيوط`. |
| 53–60 | **Product taxonomy.** `A53`=`نوع الصنف` (6 options in A54:A59); columns B–G each hold one item type's `نوع المنتج`; `H53`=`القدرة`; `I53`=`الضمان بالشهر`; `N53`=regions. | Parent keys come from the *header row*, so the cascade is data, not hardcoded. |

Rendering: `_` → space throughout (`ميت_غمر` → `ميت غمر`, `خزان_تيوبلس_19لتر` → `خزان تيوبلس 19 لتر`). Excel uses `_` to defeat autoformatting; it is never UI text.

5 governorate spellings are corrected to match the live site via an explicit `DISPLAY_OVERRIDES` table (الأقصر، الإسكندرية، الإسماعيلية، أسوان، أسيوط). Editable in one place, not scattered.

Output committed to the repo so the app has **zero runtime dependency on the workbook**. `tools/.work/` is a re-extractable build artifact — gitignore it, never edit it. The generator **self-heals**: if `.work/` is missing it re-extracts from the `.xlsx`, and it probes for `sharedStrings.xml` because this workbook is saved with a nested `xl/xl/` layout.

**Verified 2026-10-01:** both tools run clean from `D:\Tervina Group\tools\`, and re-running either produces **byte-identical** output for `governorates.ts`, `productOptions.ts`, and `seed.sql`.

#### Warranty resolution — verified 2026-10-01

Durations were keyed in the **client's** spelling and resolved onto **workbook** spellings by `tools/resolve-warranty.mjs`. Result: **22/22 products resolve, 0 failures** — 17 exact, 5 declared aliases, 4 deliberately duration-less, **0 fuzzy**.

The 5 variant spellings were confirmed by the client as *"the same thing"*, so they are declared as an explicit `ALIASES` table — business data, not a distance guess. The fuzzy matcher stays as a safety net and now matches **nothing**, which is the proof that no *other* pair is quietly drifting. A declared alias whose target doesn't exist in that item type is a hard error, and an alias no longer used by any client term is reported **stale** and fails the run.

| `item_type` | `product_type` | months | match |
|---|---|---|---|
| طلمبات ايطالى تحضير | فاما · ماتريكس · رافيلو | 84 | exact |
| طلمبات ايطالى تحضير | رودلف | 36 | **alias** ← `رولدف` |
| طلمبات ايطالى تحضير | فينوكس | 36 | exact |
| طلمبات صينى تحضير | ترفينا | 24 | exact |
| طلمبات صينى تحضير | ترفينا بريمير | 24 | **alias** ← `ترفينا_برمير` |
| طلمبات صينى تحضير | ميرو | 12 | exact |
| طلمبات صينى تحضير | ميرو بريمير | 12 | **alias** ← `ميرو _برمير` |
| طلمبات صينى تحضير | كيرمينا | 12 | exact |
| طلمبات صينى تحضير | كرمينا بريمير | 12 | **alias** ← `كيرمينا_برمير` |
| طلمبات صينى تحضير | فرندس | 12 | exact |
| طلمبات اعماق | فاما · ترفينا | 60 | exact — **list overridden (D24)** |
| طلمبات غاطس | فاما · ترفينا | 60 | exact |
| حمايه | خزان تيوبلس 19لتر | 12 | **alias** ← `خزان تيوبلس 19 لتر` |
| حمايه | خزان تيوبلس 24 لتر | 18 | exact |
| سباحه | scp · sbp · lp · vmax | **`null`** | none yet — editable in Settings |

Matching ladder: `exact` → **`ALIASES` (declared)** → `folded` (hamza/ta-marbuta/ya/alef) → `despaced` (Arabic spacing drift) → `Damerau-Levenshtein ≤ 2` **word-wise**, so a long name can't drift wholesale. One client term resolving to **two** canonical products is a hard failure, not a silent overwrite.

> The sheet is **terminology-canonical** (D23) — including its own internal inconsistency `خزان تيوبلس 19لتر` (no space) next to `خزان تيوبلس 24 لتر` (space). Both render verbatim as written. Purely cosmetic; say the word and I'll normalize the spacing in one `DISPLAY_OVERRIDES`-style entry.

The same resolver generates the `warranty_rules` seed, so the Settings baseline and the shipped table **cannot drift**.

#### Product-list override (D24)

`طلمبات اعماق` is the only place the message disagrees with the workbook. The generator applies it as a declared `PRODUCT_OVERRIDES` entry and prints the substitution to `report.txt` — a logged override, never a silent edit.

#### Settings — admin-editable durations (D22)

Resolution order at runtime: `warranty_rules` row → generated base → `null`.

- Staff-only RLS. Anon gets **no access** — durations aren't customer data, so deny by default, grant to `is_staff`.
- The generated TS stays in the repo as the base layer, so `tools/gen-data.mjs` remains reproducible.
- Editor: filter by `item_type`, inline numeric input per row, empty = `null`. **Save per row**, not save-all — 22 rows of unsaved edits is a footgun.
- **Duration is snapshotted onto the claim at submit** (D25). Editing a duration must never rewrite a past certificate.
- Editors for cities / sectors / products are **not** built. They'd follow this exact shape if wanted later — a separate decision, deliberately not taken now.

### Database schema

```sql
customers
  id uuid pk default gen_random_uuid()
  auth_user_id uuid unique not null references auth.users(id)
  full_name text not null
  phone text not null unique            -- E.164 normalized (+20…)
  governorate text not null
  city text not null
  sector text not null                  -- القطاع, AUTO-FILLED from governorate (D17)
  created_at, updated_at timestamptz

warranty_claims
  id uuid pk                            -- CLIENT-generated (see ordering rationale)
  reference_code text unique not null   -- 'TW-2026-000123' → Sheet1 col A
  customer_id uuid not null references customers(id)
  auth_user_id uuid not null            -- owner, for RLS
  status text not null default 'pending_review'
                                  -- pending_review | approved | rejected
  serial text not null unique          -- GLOBAL UNIQUE (D18) — fraud/duplicate guard
  item_type text not null               -- نوع الصنف
  product_type text not null            -- نوع المنتج/الموتور (must belong to item_type)
  capacity text not null                -- القدرة      (independent)
  warranty_months int                   -- الضمان الشهري; DERIVED from product_type
  warranty_start date                   -- بدايه الضمان  (Sheet1 C) = submit date
  warranty_end   date                   -- نهايه الضمان  (Sheet1 E) = start + months
  technician_name text not null         -- belongs to the CLAIM, not the customer
  technician_phone text not null
  -- ---- admin state (3 independent checks) ----
  reviewed_at      timestamptz          -- NULL = not yet reviewed
  reviewed_by      uuid                 -- staff user
  rejection_reason text                 -- shown when status = rejected
  sent_to_customer boolean not null default false
  sent_at          timestamptz
  photos_exported  boolean not null default false
  photos_exported_at timestamptz
  notes text                            -- ملاحظات (Sheet1 W), customer + admin
  source text not null default 'online' -- online | legacy_import (D19)
  created_at timestamptz default now()

  index (status, created_at desc)       -- dashboard + filtered table
  index (customer_id)
  index (sector)
  index lower(full_name)                -- admin name search lives on customers
```

```sql
claim_photos
  id uuid pk
  claim_id uuid not null references warranty_claims(id) on delete cascade
  kind text not null        -- rosetta_label | bowl_barcode | product_label | invoice
  storage_path text not null
  detected_serial text      -- barcode shots only
  sharpness_score real      -- NULL for manual invoice shots
  created_at timestamptz
  unique (claim_id, kind)

warranty_rules             -- D22: admin-editable durations
  id uuid pk default gen_random_uuid()
  item_type text not null
  product_type text not null
  warranty_months int                -- NULL = "لم يُحدد بعد" (e.g. سباحه)
  updated_at timestamptz not null default now()
  updated_by uuid references auth.users(id)
  unique (item_type, product_type)

staff                      -- D28: WHO may use the admin panel
  id uuid pk default gen_random_uuid()
  user_id uuid unique references auth.users(id)   -- NULL until the person claims the account
  email text not null unique            -- the admin types this to grant access
  full_name text not null
  is_active boolean not null default true
  added_by uuid references auth.users(id)
  created_at timestamptz not null default now()
```

**Staff access flow (D28).** An admin adds a row with an email. That person signs up / logs in with the **same email** via Supabase Auth; the app links `user_id` on first successful login. RLS grants admin reads/writes only via `exists (select 1 from staff where user_id = auth.uid() and is_active)`.

- **No password column.** Supabase Auth owns credentials; `staff` owns authorisation. Storing passwords here would be a strictly worse reimplementation.
- **Bootstrap the first admin by SQL**, since there is no admin yet to add one: one `insert into staff (email, full_name)` in the setup notes, with `user_id` filled on first login. Everything after that is done from the Admin UI.
- `is_active = false` revokes access **immediately** without deleting history — a departing staff member's past reviews stay attributed.
- Customer anonymous sessions (D1) never appear in `staff`, so anon keys can never satisfy this check.

> **Domain call:** `technician_name/phone` live on the **claim**, not the customer. One customer can activate several products installed by different technicians. The customer's cached copy is a UX convenience only.
> **Denormalization avoided:** tracking joins `claims → customers` for the phone. No phone snapshot column.
> **`sector` lives on the customer** (it is derived from governorate) and is snapshotted onto the claim for cheap dashboard grouping.

### Security model

| Surface | Mechanism |
|---|---|
| Customer + claim writes | RLS: `auth.uid() = auth_user_id`. Anonymous users hold the `authenticated` role, so this scopes correctly. |
| Claim reads by owner | RLS `select` on own rows. |
| Track by phone | `rpc('track_claims_by_phone')` — `SECURITY DEFINER`, returns **only** `reference_code, status, serial, created_at, product_type, capacity`. Never names/phones. |
| Storage | Bucket `warranty-photos`, **PRIVATE**. Path `claims/{claim_id}/{kind}.jpg`. Storage RLS mirrors table RLS. Admin gets signed URLs later. |
| Client uploads | JPEG q≈0.82, long edge ≤1600px, computed client-side. |

### Logging (async, non-blocking, 3 levels)

`src/core/lib/logger.ts`

- Levels: `error` · `warn` · `info`. Nothing else.
- API: `log.info('capture.rosetta.auto_fired', { sharpness: 0.71 })`
- Buffer (cap 50) → flush on 10 entries / 30s / `visibilitychange:hidden`, inside `requestIdleCallback`.
- Transport is **pluggable and a no-op by default in v1** — dev console; prod ingest Edge Function is PENDING. Fire-and-forget, never awaited on the critical path.
- **PII guard:** logger drops keys in a denylist (`phone`, `serial`, `full_name`, `technician_*`) before any transport.

---

## [ORPHANS & PENDING]

### ✅ Resolved this round

| # | Item | Resolution |
|---|---|---|
| ~~B14~~ | "4 photos" vs 3 named | **3** — it was a miscount. Manifest locked. |
| ~~B15~~ | القطاع mapping | **Official 7 groups.** Table locked above. |
| ~~B17~~ | 8 uncollected Sheet1 columns | **Exported empty**, wizard unchanged (D21). |
| ~~B20~~ | RAR encoding | **ZIP.** RAR is impossible open-source; client accepted ZIP (D20). |
| ~~B13~~ | **Taxonomy + warranty mapping** | **Resolved 2026-10-01.** `سباحه` = no duration for now (D22). `طلمبات اعماق` = `فاما·ترفينا` per the message (D24). Workbook spelling authoritative (D23). **Verified 22/22** by `tools/resolve-warranty.mjs`. |
| ~~B12~~ | `نوع المنتج` vs `نوع الموتور` | **Workbook wins** — `نوع الموتور` everywhere (D23). |
| ~~Q2~~ | Label contents | **Square/rect white label**, framed by its own 4 bright corners (D27). Model: no image tooling available, so the client described it. |
| ~~Q3~~ | Serial format | **Digits only**, stored as `text` (D26). No fixed length yet — one tunable constant until real serials arrive. |
| ~~Q5~~ | Staff management | **`staff` table** + Supabase Auth identity (D28). First admin bootstrapped by SQL. |
| ~~O5~~ | Deployment target | **New domain, new site** (D29). Frontend: Cloudflare Pages (verified unlimited bandwidth). Backend: Supabase Pro, **spend cap OFF** so quotas become billing, not restriction. Self-hosting kept open as a documented exit. |
| ~~O10~~ | Dropdown order | **Live-site order, Cairo first** (D16). |
| ~~O11~~ | Region list | Escalated then resolved → **B15**. |
| ~~O1c~~ | `كيرمينا` vs `كرمينا بريمير` | Separate types, **both kept**, workbook spellings (D23). |
| ~~Q4~~ | Duplicate serials | **Globally unique** (D18). |

**🔴 No blockers remain.**

### 🟡 Open — assumed defaults, correct me and I'll adjust

| # | Item | My default unless you say otherwise |
|---|---|---|
| **B16** | Sheet1 col `U = بصوره` | Treat as legacy-only → exported **empty** (consistent with D21). |
| **B18** | ~~Admin auth~~ | **Resolved → D28** (`staff` table + Supabase Auth). |
| **B19** | Dashboard cards | The 10 cards proposed in [ADMIN PANEL]. |
| **B21** | WhatsApp `و و لمده` typo | Keep **verbatim**. |
| **O5** | ~~Deployment host~~ | **Resolved → D29.** Cloudflare Pages + Supabase Pro. |
| **O6** | Anonymous sign-in 30/hr/IP | Accept for v1; log the rate-limit error rather than adding a CAPTCHA. |
| **O7** | Arabic-only v1 | Confirmed per D3. |
| **O14** | `البحر الأحمر` placement | Append after `جنوب سيناء` (workbook has it; the live site omits it). |
| ~~Q4~~ | ~~Duplicate serials~~ → resolved, **D18** globally unique. |
| **NEW** | **New domain + brand name** | Needed before build: the domain to deploy to, and whether the site is still branded **Tervina** or gets a new name. Changes the header, footer, page title, logo, and the WhatsApp template's sender name. |
| **NEW** | **Supabase project ref** | Once created: the project ref + anon key, or just run the migrations I provide. |

### 🔧 Known technical issues (I own these)

- **Serial length bound is a guess.** `/^\d+$/` is solid (D26), but I have no real serial to calibrate a min/max length against. It stays one constant, and I'll log every distinct serial length seen so it can be tightened from real data rather than a guess.
- **Quad detection runs on a 240px downscale**, so corners are accurate to ~4px there and must be scaled up before cropping. Sub-pixel accuracy is irrelevant for framing a photo — but the **synthetic-frame unit test** is what makes that safe, hence it's an M5 gate rather than a nice-to-have.
- **Excel lib choice:** `exceljs` 4.4.0 for the export (write + styling). The other option, `xlsx` 0.18.5, is an abandoned SheetJS build on npm — avoided. One parser serves **both** export and legacy import.

### Known risks / accepted tradeoffs

- **No component test suite in v1.** Only `vitest` unit tests on the 4 pure logic modules. Camera behaviour verified manually on real devices. Tradeoff accepted for speed.
- **Zxing-C++ wasm ≈1.04 MiB.** Lazy-loaded only when Step 2 opens, via `import('zxing-wasm/reader')`. Self-hosted from `/wasm` via `prepareZXingModule({ overrides:{ locateFile }})` — not jsDelivr.
- **TS 7** is the native-port line. If any tool chokes, drop to 6.x; no code impact expected.
- **Phone is the only identity.** Two different people sharing a number collapse to one customer row (upsert). Acceptable for warranty; noted.
- **Durations live in the DB, taxonomy in the repo.** A duration is editable without a redeploy; adding a *product* still needs `gen-data.mjs`. Deliberate split — 22 rows change often, 274 cities never do.
- **Quad detection is the biggest remaining risk**, and it is riskier than the sharpness FSM it sits beside: a wrong-but-valid quad could frame a bad photo that still decodes. Mitigations are the validity gates, the `too_close` refusal, and post-capture validation re-running sharpness **and** decode on the actual crop. If it proves flaky on real hardware, the zxing-derived quad is a permanent acceptable fallback, not a regression.

---

## [MILESTONES]

Each gate is a **command or an observable**, not a vibe.

### M0 — Foundation
**Goal:** `npm run dev` serves the RTL shell; `npx tsc --noEmit` exits 0; `npm run build` succeeds.
- Vite 8 + React 19 + TS 7 + Tailwind 4, router, Arabic RTL shell, `/ar/activation` route stub.
- `supabase/config.toml` with `enable_anonymous_sign_ins = true`.

### M1 — Data layer
**Goal:** `npx supabase db reset` exits clean. Verified by SQL: anon key **can** insert+select own customer row and **is rejected (0 rows)** on another's.
- Schema, RLS, `track_claims_by_phone` RPC, private bucket + storage policies.

### M2 — Session + Egypt data
**Goal:** Fill Step 1, reload the page → form is prefilled and can be submitted with zero re-typing. Selecting a governorate filters the city list; deselecting clears it.
**Goal (data):** `node tools/gen-data.mjs` is idempotent and its output diffs clean against the committed `src/data/*.ts`. Regression guard: **all 27 governorates resolve to a non-empty city list** (catches the hamza-join class of bug, which silently produced 2 empty governorates during extraction).
- `tools/gen-data.mjs`, `governorates.ts`, `productOptions.ts`, `session.ts`, `phone.ts`.

### M3 — Step 1: Personal
**Goal:** valid submit creates/updates exactly one `customers` row, returns an anonymous `auth_user_id`, writes the payload to `localStorage`, and `sector` is populated from `governorate` with no user input.
- `PersonalStep`, `HomePage` dual-action state, `sector.ts`.

### M4 — Step 2: Product (cascade)
**Goal:** switching `item_type` repopulates `product_type` and clears the prior selection. A hand-crafted payload with a `product_type` outside the chosen `item_type`'s list is **rejected server-side**.
**Goal (manifest):** selecting a `… تحضير` type yields rosetta + bowl + invoice; selecting `طلمبات اعماق` yields label + invoice.
**Goal (warranty):** selecting `فاما` under `طلمبات اعماق` derives **60**, and the same `فاما` under `طلمبات ايطالى تحضير` derives **84** — proves the key is the *pair*, not the product alone. Selecting `سباحه · scp` derives **`null`**, which the UI surfaces as "لم يُحدد بعد" rather than a fake `0`.
- `ProductStep`, `photoManifest.ts`, `warrantyMap.ts` (+ `resolve-warranty` unit test).

### M5 — Auto-capture core ⚠️ highest technical risk
**Goal (unit):** on a **synthetic** frame containing a white rectangle on a dark background, `findLabelQuad` returns its 4 corners within **4px**; a frame with **no** white rectangle returns `null` and never fires. A synthetic **blurry** frame never fires; a synthetic **sharp** frame fires within 1.2s of the FSM seeing it, with zero user taps.
**Goal (margin, unit):** for a detected quad, the returned capture rect is strictly **larger** than the label on all four sides, and a quad whose expanded rect leaves the frame by >8% returns `too_close` instead of a rect.
**Goal (manual, real device):** point at the label → 4 corners lock on, an expanded frame is drawn → photo taken automatically with visible margin around the label. Deny camera permission → file-upload fallback completes the same shot with the same crop logic.
- `CameraCapture`, `useImageQuality`, `sharpness.worker`, `imagePipeline`, `labelQuad.ts` (Otsu + CC + Douglas–Peucker, dependency-free), `PhotoStep`.
- **Gate: manual shutter auto-reveals after MAX_WAIT — the flow can never deadlock.** Quad detection failing must degrade to the zxing-derived quad, then to manual, never to a dead screen.

### M6 — Barcode auto-read
**Goal:** aiming at a Code128 fills `serial` automatically, the shot completes with no tap, and the value surfaces read-only. A wrong-symbology code is rejected, not silently accepted.
**Goal (digits, D26):** a decode containing **any** non-digit is rejected → the FSM keeps scanning rather than writing a bad serial. A valid serial is stored as a string, so `0071234` stays `0071234`.
- `barcodeReader.ts`, wasm lazy-load + self-hosted `locateFile`.

### M7 — Step 4: Review + submit
**Goal:** end-to-end submit → photo objects in the private bucket + 1 `warranty_claims` row + the manifest's `claim_photos` rows, `warranty_start`/`warranty_end` computed, `reference_code` on the success screen.
**Goal:** retaking the barcode shot updates `serial`; a **duplicate serial** is rejected by the unique constraint with a friendly Arabic message.
- `ReviewStep`, `SuccessStep`, `legacySheet` mapping.

### M8 — Tracking
**Goal:** a phone with 0 claims → friendly Arabic empty state. A phone with 2 claims → both listed with status + date. RPC returns no PII fields.

### M9 — Hardening (public)
**Goal:** full journey completes on desktop (no camera) and on Android Chrome + iOS Safari. Bundle grep confirms no `localStorage` PII writes outside `session.ts`; logger denylist proven by test.

---

### Track B — Admin (starts after M1)

| # | Milestone | Verifiable goal |
|---|---|---|
| **A0** | Staff auth + shell | Non-staff hitting `/admin` is redirected. A staff user reaches it. RLS blocks the anon key from every admin read/write (verified by SQL, not by a hidden UI check). |
| **A1** | Dashboard | 10 cards render live counts; the numbers match a hand-run `GROUP BY` on the same table. |
| **A2** | Orders table | Rows are closed by default and expand on click. Status filter narrows correctly. One search box matches on **name OR phone OR serial** (verify all three with 3 seeded rows). |
| **A3** | مراجعة | Approve flips `status`; decline flips it **and requires a reason**; a declined claim disappears from the stats totals, the Excel export, and the photo archive. |
| **A4** | إرسال للعميل | Button is **disabled unless `status = approved`**. Clicking opens `wa.me` with the template; `sent_to_customer` becomes `true`. Spot-check the URL is correctly percent-encoded (Arabic + RTL). |
| **A5** | رفع الصور | Only `approved AND photos_exported = false` are included. ZIP contains one folder per `serial`, named exactly that. Re-running includes nothing new. *(D20)* |
| **A6** | تحميل اكسيل | Modal offers الكل / فترة معينة / أنهاردة. Downloaded `.xlsx` has the **exact 23 headers in A→W order**, the 8 legacy-only columns empty, and row count matching the filter. *(D21)* |
| **A7** | رفع بيانات قديمة | Importing a Sheet1-shaped file creates claims with `reviewed + sent + photos_exported = true`. Re-importing the same file **fails on duplicate serial** — this is the fraud baseline (D18). Malformed rows are reported per-row, not silently skipped. |
| **A8** | **الإعدادات (Settings)** | All 22 rows render with their current duration. Setting `سباحه · scp` to a number and reloading changes what a **new** claim derives — and a claim submitted **before** the edit still shows its old duration (D25). Empty cell saves as `null`, not `0`. Non-staff is rejected by RLS, not just hidden in the UI. |
| **A9** | **Admins (staff)** | Admin A adds `b@example.com` by email. That person signs up with the same email, lands in `/admin`, and a 4th row appears for editing their entry. Setting `is_active = false` revokes their access on the **next request**, while their past `reviewed_by` stays intact. The anon key is rejected by RLS for every staff operation. |

---

**No blockers remain. M4 and all of Track B are clear to build — say go and I'll scaffold M0.**