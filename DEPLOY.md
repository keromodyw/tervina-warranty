# Getting this online — the actual plan

You do **not** need to buy a domain. `*.pages.dev` is free, HTTPS, and works today.

## Why no domain is the fast path

The camera is the binding constraint, not branding. `getUserMedia` runs only in a
**secure context** (HTTPS or `localhost`). So the requirement is "HTTPS somewhere",
and `pages.dev` gives that immediately. A domain changes the text in the address
bar; it changes nothing else.

---

## STEP 1 - Do this first (2 minutes, blocks everything)

Open <https://supabase.com/dashboard/project/luorbjecmvqneyuosipk/auth/providers>
and turn on **Anonymous Sign-ins**.

> This is currently **OFF**. It was verified against the live project, not assumed.
> Without it every customer fails at the first sign-in, so the activation form is
> dead in the water. `supabase/config.toml` only affects a *local* stack - it does
> not change the cloud project.

Then paste `supabase/APPLY-ALL.sql` into **SQL Editor → Run**. One paste creates
all nine migrations plus the 22 warranty rules.

Finally paste `supabase/tests/rls-isolation.sql` and Run. You want a wall of green
`PASS (...)` lines and no `FAIL`. That proves no customer can read another's data.

## STEP 2 - Go live (10 minutes)

### One-time (needs your login)

```
npx wrangler login
```

Opens your browser - approve it.

### Create and deploy

```
wrangler pages project create tervina-warranty
npm.cmd run build
npx wrangler pages deploy dist --project-name tervina-warranty
```

You get `https://tervina-warranty.pages.dev`. Camera works. Done.

### Or: auto-deploy from GitHub, no terminal after setup

Push to GitHub, then Cloudflare Pages → *Create* → *Pages* → *Connect to Git*:

- Build command: `npm run build`
- Output directory: `dist`

Every `git push` deploys itself.

### Zero-setup alternative (~3 min)

Build, then drag `dist` into <https://app.netlify.com/drop>. Immediate HTTPS URL,
no account. Good for testing on a real phone, but the URL changes on each re-drop
and it is not permanent.

---

## What is actually live if you publish right now

**The four-step wizard is not built yet.** What goes live today:

- the Arabic RTL shell, Cairo font, Tervina design tokens
- the home page with its two actions
- empty routes at `/ar/activation`, `/ar/track`, `/admin`

Done: **M0** (scaffold, builds clean) and **M1** (schema, RLS, tracking RPC, photo
bucket - authored, and awaiting Step 1 to be executed).

## Prerequisites still missing

| Blocker | Needed for | Who |
|---|---|---|
| Anonymous sign-ins ON | Every customer activation | you (Step 1) |
| `APPLY-ALL.sql` executed | Tables, RLS, tracking, photos | you (Step 1) |
| Cloudflare login | Publishing | you (Step 2) |
| First admin account | Admin panel | you - row is ready for `keromodyw@gmail.com`, just add the user in Authentication → Users |
| Wizard steps M2–M7 | The actual product | me |

---

## Why not a `.ct.ws` domain

A free subdomain provider owns the parent zone (`ct.ws`), so you cannot delegate
its nameservers to Cloudflare. Cloudflare therefore cannot issue a certificate for
it, and without HTTPS the camera cannot run at all. Also worth knowing:
`freeinfinity.com` is now a parked domain listed at $4,295.

## Later, if you want your own name

Buy a real domain (a `.com` is ~$10/yr) and add it in Cloudflare Pages → *Custom
domains*. Zero code changes. Nothing above depends on this.
