import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

// GitHub Pages project sites serve from /<repo>/, not the root. Cloudflare
// Pages and a custom domain serve from /. PAGES_BASE lets one codebase target
// both: unset for the real deploy, "/repo/" for a GitHub Pages test. The value
// is also exposed to the app as import.meta.env.BASE_URL, which router.tsx uses
// as the React Router basename so deep links keep working under a subpath.
const base = process.env.PAGES_BASE ?? '/'

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
    // zxing-wasm is lazy-loaded via dynamic import(); keep it out of the
    // initial bundle so the wizard shell stays small. See PROJECT_MAP D2.
    target: 'es2022',
    sourcemap: true,
  },
  worker: {
    format: 'es',
  },
})