import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The size budget reads which chunks each screen needs (scripts/build/web-size-budget.mjs).
  // The router in one chunk: split across the lazy screens that share it, it gzips worse.
  build: {
    manifest: true,
    rolldownOptions: {
      output: { advancedChunks: { groups: [{ name: 'router', test: /[\\/]@tanstack[\\/]/ }] } },
    },
  },
  // Development only: the Worker serves the API on the same origin in every environment.
  server: { proxy: { '/api': 'http://localhost:8787' } },
  test: { environment: 'jsdom' },
})
