import { defineConfig, devices } from '@playwright/test'

const PERSIST = '.wrangler/e2e'
// Not 8787: `pnpm work verify` and `wrangler dev` use it with other data.
const PORT = 8788
// HTTPS with wrangler's local certificate: the __Host- cookies are Secure, so the browser and
// Playwright's cookie API accept them only there, as in production.
const LOCAL_URL = `https://localhost:${PORT}`
// Smoke mode (@id:access-96-18): against a deployed environment, with no local server.
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
        `wrangler d1 migrations apply global-local --local --persist-to ${PERSIST}`,
        `wrangler d1 migrations apply shard-1-local --local --persist-to ${PERSIST}`,
        `node ../../scripts/db/seed.mjs --persist-to ${PERSIST}`,
        `wrangler dev --local --ip localhost --local-protocol https --port ${PORT} --persist-to ${PERSIST}`,
      ].join(' && '),
      url: `${LOCAL_URL}/health`,
      ignoreHTTPSErrors: true,
      // A server already running skips the migrations and the seed above.
      reuseExistingServer: false,
      timeout: 120_000,
    },
  }),
})
