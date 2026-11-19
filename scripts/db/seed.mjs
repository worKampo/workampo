// Local only by construction (ADR-0044): it takes no environment, database name or --remote.
//   node scripts/db/seed.mjs [--persist-to <dir>]
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { assertEnvVars, d1Config, main, realIo } from './d1.mjs'

export const LOCAL_DATABASES = { global: 'global-local', shard: 'shard-1-local' }
const USAGE = 'Usage: node scripts/db/seed.mjs [--persist-to <dir>]'

export function parseArgs(argv) {
  if (argv.length === 0) return {}
  if (argv.length === 2 && argv[0] === '--persist-to' && argv[1] && !argv[1].startsWith('-'))
    return { persistTo: resolve(argv[1]) }
  throw new Error(`Unknown argument. ${USAGE}`)
}

export function assertLocal(io) {
  assertEnvVars(io.env, 'local')
  const databases = d1Config(io.readConfig(), 'local')
  for (const name of Object.values(LOCAL_DATABASES)) {
    const id = databases.find((db) => db.database_name === name)?.database_id ?? ''
    if (!id.startsWith('local-'))
      throw new Error(`${name} resolves to database_id "${id}", not a local- one: refusing to seed`)
  }
}

export function seed({ persistTo } = {}, io) {
  assertLocal(io)
  const plan = Object.entries(LOCAL_DATABASES).map(([kind, db]) => ({
    db,
    files: io.seedFiles(kind),
  }))
  if (plan.every(({ files }) => files.length === 0)) {
    io.log('No seed files in packages/db/seed/: nothing to seed.')
    return
  }
  const persist = persistTo ? ['--persist-to', persistTo] : []
  for (const { db, files } of plan)
    for (const file of files) {
      io.log(`Seeding ${db} with ${file}`)
      io.wrangler(['d1', 'execute', db, '--local', '--file', file, ...persist])
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main(() => seed(parseArgs(process.argv.slice(2)), realIo()))
