import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { buildVersion } from '../../scripts/build/spa-version.mjs'

// Every build carries a real version (R8); dev and vitest run as 'dev'.
export default defineConfig(({ command }) => ({
  ...(command === 'build' && { define: defineVersion() }),
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
  // A test's own finds wait up to 5 s (asyncUtilTimeout); the test needs room above that for its
  // first visit, which loads lazy screens and translations, when the whole check runs at once.
  test: { environment: 'jsdom', testTimeout: 15_000 },
}))

function defineVersion() {
  const { version, buildDate } = buildVersion({ env: process.env })
  return {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(version),
    'import.meta.env.VITE_APP_BUILD_DATE': JSON.stringify(buildDate),
  }
}
