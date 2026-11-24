import { defineConfig, devices } from '@playwright/test'

// The page journeys of the web run against the API Worker that serves it, like the API's own
// suite (apps/api/playwright.config.ts), on their own port and local state so both can run at once.
const API = '../api'
const PERSIST = '.wrangler/e2e-web'
const PORT = 8789
const LOCAL_URL = `https://localhost:${PORT}`
const deployedUrl = process.env.E2E_BASE_URL

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  ...(process.env.CI && { workers: 1 }),
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }], ['list']],
  use: {
    baseURL: deployedUrl ?? LOCAL_URL,
    ignoreHTTPSErrors: !deployedUrl,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  ...(!deployedUrl && {
    webServer: {
      command: [
        `cd ${API}`,
        `wrangler d1 migrations apply global-local --local --persist-to ${PERSIST}`,
        `wrangler d1 migrations apply shard-1-local --local --persist-to ${PERSIST}`,
        `node ../../scripts/db/seed.mjs --persist-to ${PERSIST}`,
        `wrangler dev --local --ip localhost --local-protocol https --port ${PORT} --persist-to ${PERSIST}`,
      ].join(' && '),
      url: `${LOCAL_URL}/health`,
      ignoreHTTPSErrors: true,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  }),
})
