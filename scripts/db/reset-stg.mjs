// Wipes and seeds the staging databases. Only reset-stg.yml runs it; staging is the only target there is.
//   node scripts/db/reset-stg.mjs
import { pathToFileURL } from 'node:url'
import { assertEnvVars, assertInActions, d1Config, main, parseRows, realIo, target } from './d1.mjs'

const ENV = 'stg'
export const STG_DATABASES = { global: 'global-stg', shard: 'shard-1-stg' }

// d1_migrations is dropped with the rest so the migrations rebuild schema and reference data.
const LIST_TABLES =
  "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'"

export function wipeSql(tables) {
  // Deferred foreign keys let tables drop in any order.
  return ['PRAGMA defer_foreign_keys = ON', ...tables.map((t) => `DROP TABLE "${t}"`)].join(';\n')
}

function wipe(db, io) {
  const tables = parseRows(
    io.wrangler(['d1', 'execute', db, ...target(ENV), '--json', '--command', LIST_TABLES], {
      capture: true,
    }),
  ).map((row) => row.name)
  if (tables.every((name) => name === 'd1_migrations')) io.log(`${db}: no tables, nothing to wipe.`)
  else {
    io.log(`${db}: dropping ${tables.join(', ')}.`)
    io.wrangler(['d1', 'execute', db, ...target(ENV), '--command', wipeSql(tables)])
  }
  // Always, so a rerun after a failure between the drop and the apply rebuilds the schema.
  io.wrangler(['d1', 'migrations', 'apply', db, ...target(ENV)])
}

export function resetStg(argv, io) {
  if (argv.length) throw new Error('reset-stg takes no arguments: its only environment is stg')
  assertInActions(io.env, 'reset-stg')
  assertEnvVars(io.env, ENV)
  const configured = d1Config(io.readConfig(), ENV).map((db) => db.database_name)
  for (const db of Object.values(STG_DATABASES))
    if (!configured.includes(db)) throw new Error(`${db} is not in env.stg of wrangler.jsonc`)

  for (const [kind, db] of Object.entries(STG_DATABASES)) {
    wipe(db, io)
    const files = io.seedFiles(kind)
    if (!files.length) io.log(`${db}: no seed files, nothing to seed.`)
    for (const file of files) {
      io.log(`Seeding ${db} with ${file}`)
      io.wrangler(['d1', 'execute', db, ...target(ENV), '--file', file])
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main(() => resetStg(process.argv.slice(2), realIo()))
