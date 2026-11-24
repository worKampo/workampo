import { defineConfig } from 'drizzle-kit'

// `pnpm db:migration:new` sets it: global and shard are separate databases with their own history.
const kind = process.env.DB_KIND ?? 'global'
if (kind !== 'global' && kind !== 'shard') throw new Error('DB_KIND must be global or shard')

export default defineConfig({
  dialect: 'sqlite',
  schema: `./schema/${kind}.d1.ts`,
  out: `./migrations/${kind}.d1`,
  casing: 'snake_case',
})
