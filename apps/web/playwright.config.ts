import { defineConfig, devices } from '@playwright/test'

// The page journeys of the web run against the API Worker that serves it, like the API's own
// suite (apps/api/playwright.config.ts), on their own port and local state so both can run at once.
const API = '../api'
const PERSIST = '.wrangler/e2e-web'
// The journeys sign the seed accounts in many times, and the database (with its limit counters)
// outlives a run; the limits themselves are the API suite's to test.
const SIGN_IN_LIMITS = [
  'RATE_LIMIT_CODE_REQUESTS_PER_EMAIL:1000',
  'RATE_LIMIT_CODE_ATTEMPTS_PER_EMAIL:1000',
]
  .map((value) => `--var ${value}`)
  .join(' ')
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
        `wrangler dev --local --ip localhost --local-protocol https --port ${PORT} --persist-to ${PERSIST} --var PUBLIC_BASE_URL:${LOCAL_URL} ${SIGN_IN_LIMITS}`,
      ].join(' && '),
      url: `${LOCAL_URL}/health`,
      ignoreHTTPSErrors: true,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  }),
})
