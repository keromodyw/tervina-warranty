import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
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