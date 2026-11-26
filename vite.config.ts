/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'

// GitHub Pages serves a project page from /<repo>/ and has no rewrite rules.
// Copying index.html to 404.html makes every unknown path boot the app,
// which then routes on the real address, so deep links and refreshes work.
const spaFallbackForPages = {
  name: 'spa-fallback-for-pages',
  closeBundle() {
    const out = resolve(import.meta.dirname, 'dist')
    copyFileSync(resolve(out, 'index.html'), resolve(out, '404.html'))
  },
}

export default defineConfig({
  base: '/debuglab/',
  plugins: [react(), tailwindcss(), spaFallbackForPages],
  test: {
    include: ['src/**/*.test.ts'],
  },
})
