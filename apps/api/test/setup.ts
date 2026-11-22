import { applyD1Migrations, type D1Migration } from 'cloudflare:test'
import { env } from 'cloudflare:workers'

// Bound only by vitest.config.ts, so it is not part of the Worker's Env.
const { TEST_MIGRATIONS } = env as unknown as { TEST_MIGRATIONS: D1Migration[] }

await applyD1Migrations(env.DB_GLOBAL, TEST_MIGRATIONS)
