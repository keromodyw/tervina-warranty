# Getting this online — the actual plan

You do **not** need to buy a domain. `*.pages.dev` is free, HTTPS, and works today.

## Why no domain is the fast path

The camera is the binding constraint, not branding. `getUserMedia` runs only in a
**secure context** (HTTPS or `localhost`). So the requirement is "HTTPS somewhere",
and `pages.dev` gives that immediately. A domain changes the text in the address
bar; it changes nothing else.

---

## Path A — online in ~3 minutes (see it working, no account)

Zero setup. Proves HTTPS, RTL, camera and the backend on a real phone.

1. Build locally:
   ```
   npm.cmd run build
   ```
2. Open <https://app.netlify.com/drop> and drag the `dist` folder onto the page.
3. You get an immediate `https://<random>.netlify.app` URL. Camera works.

Use this to sanity-check on a real phone. It is **not** permanent — the URL changes
on every re-drop.

## Path B — permanent free home (recommended, ~10 minutes)

Cloudflare Pages. Free forever, no bandwidth cap, your own URL.

### One-time setup (you must do this — it needs your login)

1. Create a free account: <https://dash.cloudflare.com/sign-up>
2. In a terminal:
   ```
   npm.cmd install -g wrangler
   wrangler login
   ```
   This opens your browser. Approve it.

### Then create the project

```
wrangler pages project create tervina-warranty
```

### Deploy (from the project folder)

```
npm.cmd run build
npx wrangler pages deploy dist --project-name tervina-warranty
```

You get `https://tervina-warranty.pages.dev`. Done.

### Auto-deploy from GitHub instead (no terminal after setup)

Push this repo to GitHub, then in Cloudflare Pages → *Create* → *Pages* → *Connect
to Git*, pick the repo and set:

- Build command: `npm run build`
- Output directory: `dist`

Every `git push` then deploys itself.

---

## What is actually live if you publish right now

Be aware: **the four-step wizard is not built yet.** What would go live today is:

- the Arabic RTL shell, Cairo font, Tervina design tokens
- the home page with its two actions
- empty routes at `/ar/activation`, `/ar/track`, `/admin`

Milestones completed: **M0** (scaffold, builds clean) and **M1** (database schema,
RLS, tracking RPC, photo bucket — authored but **never executed**).

Order of work from here:

1. Publish the shell now so you have a URL. *(optional but satisfying)*
2. Apply the M1 migrations to Supabase and run the RLS isolation test.
3. Build M2–M7: the wizard, camera, barcode, admin panel.

## Prerequisites that are still missing

| Blocker | Needed for |
|---|---|
| Working Supabase anon key | Any database write. Current key returns 401 — re-copy from Dashboard → API. Look for one starting `sb_publishable_` |
| First admin email + full name | Booting the admin panel. Also edit `supabase/admin/bootstrap-first-admin.sql` |

---

## Why not a `.ct.ws` domain

A free subdomain provider owns the parent zone (`ct.ws`), so you cannot delegate
its nameservers to Cloudflare. Cloudflare therefore cannot issue a certificate for
it, and without HTTPS the camera cannot run at all. See the note in the top-level
`PROJECT_MAP.md`.

## Later, if you want your own name

Buy a real domain (a `.com` is ~$10/yr) and add it in Cloudflare Pages → *Custom
domains*. Zero code changes. Nothing above depends on this.
