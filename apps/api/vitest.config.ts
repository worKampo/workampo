import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin'
import { configDefaults, defineConfig } from 'vitest/config'

// Node sets it; the Workers types this project uses do not declare it.
declare global {
  interface ImportMeta {
    dirname: string
  }
}

// Relative to this file: Vitest runs from apps/api, knip loads the config from the repo root.
const migrations = await readD1Migrations(
  `${import.meta.dirname}/../../packages/db/migrations/global`,
)

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      // The local per-IP limit is high for E2E, where every request comes from one IP.
      miniflare: {
        bindings: { TEST_MIGRATIONS: migrations, RATE_LIMIT_CODE_REQUESTS_PER_IP: '20' },
      },
    }),
  ],
  test: { exclude: [...configDefaults.exclude, 'e2e/**'], setupFiles: ['./test/setup.ts'] },
})
