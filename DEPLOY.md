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

## STEP 2 - Go live

Two hosts are wired up and both are free. They differ in one way that matters:
**GitHub Pages can be public-only on the free plan and has a 100 GB/month soft
bandwidth limit; Cloudflare Pages has neither cap.** Use GitHub now to test, and
Cloudflare when real customers arrive.

### Option A - GitHub Pages (testing now)

Camera works: `github.io` is HTTPS. Nothing to buy.

1. Create a repo on GitHub and push this project to it (see *Step 2a* below).
2. Repo → **Settings → Pages → Source: GitHub Actions**. One time.
3. Repo → **Settings → Secrets and variables → Actions**, add two repository
   secrets. Values are the same two lines as `.env.example`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Push to `main`. The workflow in `.github/workflows/deploy-pages.yml` builds,
   tests, and publishes. URL: `https://<user>.github.io/<repo>/`.

**Free-plan caveat:** Pages from a private repo requires a paid plan. This repo
contains no secrets - the anon key is public by design and is injected at build
time from the secrets above, never committed - so a **public repo is fine**.

**Step 2a - push:**

```
gh auth login            # one time
gh repo create tervina-warranty --public --source=. --remote=origin --push
```

### Option B - Cloudflare Pages (final host)

```
npx wrangler login       # one time, opens your browser
wrangler pages project create tervina-warranty
npm.cmd run build
npx wrangler pages deploy dist --project-name tervina-warranty
```

You get `https://tervina-warranty.pages.dev`. No bandwidth cap.

Or auto-deploy from GitHub: Cloudflare Pages → *Create* → *Pages* →
*Connect to Git*, build command `npm run build`, output `dist`.

> Both hosts can later take the GoDaddy domain from *Custom domains*. The domain
> does not care which host serves it.

### Why the build has two entry points

`npm run build` targets a root-served host (`pages.dev`, a custom domain).
`npm run build:pages` targets GitHub Pages, which serves a project repo from
`/<repo>/`, not the root. The difference is `PAGES_BASE`, which sets Vite's asset
base **and** the React Router basename, so assets and deep links resolve either
way. `build:pages` also emits `404.html` (GitHub Pages has no server-side
rewrite, so a refresh on `/ar/track` would otherwise 404) and `.nojekyll`.

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
| A GitHub repo + 2 Actions secrets | Publishing to github.io | you (Step 2A) |
| Cloudflare login | Publishing to pages.dev (final) | you (Step 2B) |
| First admin account | Admin panel | you - row is ready for `keromodyw@gmail.com`, just add the user in Authentication → Users |
| Wizard steps M3–M7 | The actual product | me |

---

## Why not a `.ct.ws` domain

A free subdomain provider owns the parent zone (`ct.ws`), so you cannot delegate
its nameservers to Cloudflare. Cloudflare therefore cannot issue a certificate for
it, and without HTTPS the camera cannot run at all. Also worth knowing:
`freeinfinity.com` is now a parked domain listed at $4,295.

## Later, if you want your own name

Buy a real domain (a `.com` is ~$10/yr) and add it in Cloudflare Pages → *Custom
domains*. Zero code changes. Nothing above depends on this.
