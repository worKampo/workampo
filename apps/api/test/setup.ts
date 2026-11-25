import { applyD1Migrations, type D1Migration } from 'cloudflare:test'
import { env } from 'cloudflare:workers'

// Bound only by vitest.config.ts, so they are not part of the Worker's Env.
const { TEST_GLOBAL_MIGRATIONS, TEST_SHARD_MIGRATIONS } = env as unknown as {
  TEST_GLOBAL_MIGRATIONS: D1Migration[]
  TEST_SHARD_MIGRATIONS: D1Migration[]
}

await applyD1Migrations(env.DB_GLOBAL, TEST_GLOBAL_MIGRATIONS)
await applyD1Migrations(env.DB_SHARD_1, TEST_SHARD_MIGRATIONS)
