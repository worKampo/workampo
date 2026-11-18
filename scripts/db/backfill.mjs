// Runs packages/db/backfills/<name>.ts|.mjs in batches (ADR-0044). Remote only from backfill.yml.
//   node scripts/db/backfill.mjs <name> [--env local|stg|prod] [--batch N] [--after <id>] [--dry-run]
// A backfill module exports:
//   description: string
//   database: 'global' | 'shard'   (shard runs on every DB_SHARD_<n>)
//   select(limit, after): SQL returning at most `limit` rows with an `id`, ordered by id, after the
//     SQL literal `after` (NULL on the first batch)
//   apply(rows): SQL statements for those rows; quote values with sqlLiteral from scripts/db/d1.mjs
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  assertEnvVars,
  assertInActions,
  d1Config,
  databaseNames,
  main,
  parseRows,
  ROOT,
  realIo,
  sqlLiteral,
  target,
} from './d1.mjs'

const ENVIRONMENTS = ['local', 'stg', 'prod']
// Statements go in one --command argument; keep batches small enough for the command line.
const DEFAULT_BATCH = 100
const BACKFILLS_DIR = join(ROOT, 'packages', 'db', 'backfills')
const USAGE =
  'Usage: node scripts/db/backfill.mjs <name> [--env local|stg|prod] [--batch N] [--after <id>] [--dry-run]'

export function parseArgs(argv) {
  const [name, ...rest] = argv
  if (!name || !/^[a-z0-9][a-z0-9-]*$/.test(name))
    throw new Error(`Missing or invalid backfill name. ${USAGE}`)
  const options = { name, env: 'local', batch: DEFAULT_BATCH, after: null, dryRun: false }
  for (let i = 0; i < rest.length; i++) {
    const [flag, value] = [rest[i], rest[i + 1]]
    if (flag === '--dry-run') options.dryRun = true
    else if (flag === '--env' && ENVIRONMENTS.includes(value)) options.env = rest[++i]
    else if (flag === '--batch' && /^[1-9]\d*$/.test(value ?? '')) options.batch = Number(rest[++i])
    else if (flag === '--after' && value) options.after = rest[++i]
    else throw new Error(`Unknown or invalid argument ${flag}. ${USAGE}`)
  }
  return options
}

export async function loadBackfill(name, dir = BACKFILLS_DIR) {
  const file = ['.ts', '.mjs'].map((ext) => join(dir, `${name}${ext}`)).find(existsSync)
  if (!file) throw new Error(`No backfill ${name}.ts or ${name}.mjs in ${dir}`)
  const module = await import(pathToFileURL(file).href)
  const isValid =
    typeof module.description === 'string' &&
    ['global', 'shard'].includes(module.database) &&
    typeof module.select === 'function' &&
    typeof module.apply === 'function'
  if (!isValid) throw new Error(`${file} must export description, database, select and apply`)
  return module
}

export function assertAllowed(env, processEnv) {
  if (env === 'local') assertEnvVars(processEnv, 'local')
  else assertInActions(processEnv, `A backfill on ${env}`)
}

function runOn(db, backfill, { env, batch, after, dryRun }, io) {
  const totals = { batches: 0, rows: 0 }
  let cursor = after
  for (;;) {
    const sql = backfill.select(batch, sqlLiteral(cursor))
    const rows = parseRows(
      io.wrangler(['d1', 'execute', db, ...target(env), '--json', '--command', sql], {
        capture: true,
      }),
    )
    if (!rows.length) break
    const statements = backfill.apply(rows)
    if (dryRun) io.log(statements.join(';\n'))
    else if (statements.length)
      io.wrangler(['d1', 'execute', db, ...target(env), '--command', statements.join(';\n')])
    cursor = rows.at(-1).id
    if (cursor === undefined || cursor === null) throw new Error('select must return an id column')
    totals.batches++
    totals.rows += rows.length
    // The cursor goes to the log after each batch: --after resumes from it.
    io.log(`${db}: batch ${totals.batches}, ${rows.length} rows, cursor ${cursor}`)
    if (rows.length < batch) break
  }
  return totals
}

export async function backfill(options, io) {
  assertAllowed(options.env, io.env)
  const module = await io.load(options.name)
  const dbs = databaseNames(d1Config(io.readConfig(), options.env), module.database)
  // A cursor belongs to one database; on several shards an idempotent rerun replaces resuming.
  if (options.after !== null && dbs.length > 1)
    throw new Error(`--after needs a single database; ${module.database} has ${dbs.join(', ')}`)
  io.log(
    `${options.name} on ${options.env}${options.dryRun ? ' (dry run)' : ''}: ${module.description}`,
  )
  const summary = {}
  for (const db of dbs) summary[db] = runOn(db, module, options, io)
  for (const [db, { batches, rows }] of Object.entries(summary))
    io.log(`Done on ${db}: ${batches} batches, ${rows} rows.`)
  return summary
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main(() =>
    backfill(parseArgs(process.argv.slice(2)), { ...realIo(), load: (name) => loadBackfill(name) }),
  )
