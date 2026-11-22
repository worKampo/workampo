import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Development only: the Worker serves the API on the same origin in every environment.
  server: { proxy: { '/api': 'http://localhost:8787' } },
  test: { environment: 'jsdom' },
})
