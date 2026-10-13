// Generates dist/404.html for GitHub Pages.
//
// GitHub Pages serves static files only, so a refresh on a client-side route
// like /repo/ar/track returns GitHub's 404 page rather than the app. The
// standard workaround is to ship a 404.html that re-encodes the requested path
// into the query string and bounces back to index.html; the inline script in
// index.html decodes it before React renders (see index.html).
//
// The number of leading path segments to preserve depends on where the site is
// served: a project site lives at /<repo>/ (keep 1), a user site at / (keep 0).
// It is derived from PAGES_BASE so nothing has to be kept in sync by hand.

import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const base = process.env.PAGES_BASE ?? '/'
const distDir = join(process.cwd(), 'dist')

// '/repo/' -> 1, '/' -> 0.
const segmentsToKeep = base.split('/').filter(Boolean).length

const html = `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <title>تفعيل الضمان | تروفينا</title>
    <script>
      // Encode the real path as a query string, then hand off to index.html,
      // which decodes it back into a clean URL. See scripts/pages-404.mjs.
      var pathSegmentsToKeep = ${segmentsToKeep};
      var l = window.location;
      l.replace(
        l.protocol +
          '//' +
          l.hostname +
          (l.port ? ':' + l.port : '') +
          l.pathname.split('/').slice(0, 1 + pathSegmentsToKeep).join('/') +
          '/?/' +
          l.pathname.slice(1).split('/').slice(pathSegmentsToKeep).join('/').replace(/&/g, '~and~') +
          (l.search ? '&' + l.search.slice(1).replace(/&/g, '~and~') : '') +
          l.hash,
      );
    </script>
  </head>
  <body></body>
</html>
`

await readFile(join(distDir, 'index.html'), 'utf8').catch(() => {
  throw new Error('dist/index.html not found - run `vite build` before this script.')
})

await writeFile(join(distDir, '404.html'), html, 'utf8')

// Jekyll ignores files beginning with an underscore and would otherwise try to
// process the build output. It has nothing to do with the app, but its absence
// is the single most common cause of "works locally, blank on Pages".
await writeFile(join(distDir, '.nojekyll'), '', 'utf8')

console.log(`pages: wrote dist/404.html (base=${base}, segmentsToKeep=${segmentsToKeep})`)
