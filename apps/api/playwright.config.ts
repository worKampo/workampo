import { defineConfig, devices } from '@playwright/test'

const PERSIST = '.wrangler/e2e'
// Not 8787: `pnpm work verify` and `wrangler dev` use it with other data.
const PORT = 8788
const URL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  ...(process.env.CI && { workers: 1 }),
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }], ['list']],
  use: { baseURL: URL, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: [
      `wrangler d1 migrations apply global-local --local --persist-to ${PERSIST}`,
      `wrangler d1 migrations apply shard-1-local --local --persist-to ${PERSIST}`,
      `node ../../scripts/db/seed.mjs --persist-to ${PERSIST}`,
      `wrangler dev --local --ip 127.0.0.1 --port ${PORT} --persist-to ${PERSIST}`,
    ].join(' && '),
    url: `${URL}/health`,
    // A server already running skips the migrations and the seed above.
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
