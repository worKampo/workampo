// Creates the D1 databases and KV namespaces of stg and prod, only the missing ones, and prints their IDs:
//   CLOUDFLARE_API_TOKEN=<one-day token> CLOUDFLARE_ACCOUNT_ID=<id> node scripts/cloudflare/provision.mjs
// IDs are not secrets (ADR-0045); the token is only passed to Wrangler through the environment.
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const RESOURCES = [
  { env: 'stg', binding: 'DB_GLOBAL', kind: 'd1', name: 'global-stg' },
  { env: 'stg', binding: 'DB_SHARD_1', kind: 'd1', name: 'shard-1-stg' },
  { env: 'stg', binding: 'LANDINGS', kind: 'kv', name: 'landings-stg' },
  { env: 'prod', binding: 'DB_GLOBAL', kind: 'd1', name: 'global-prod' },
  { env: 'prod', binding: 'DB_SHARD_1', kind: 'd1', name: 'shard-1-prod' },
  { env: 'prod', binding: 'LANDINGS', kind: 'kv', name: 'landings-prod' },
]

const REQUIRED_VARS = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID']
// Wrangler is a dependency of apps/api, not of the root workspace.
const WRANGLER = join(
  fileURLToPath(new URL('../../apps/api', import.meta.url)),
  'node_modules',
  'wrangler',
  'bin',
  'wrangler.js',
)

export function missingVars(env) {
  return REQUIRED_VARS.filter((name) => !env[name])
}

export function createArgs({ kind, name }) {
  return kind === 'd1'
    ? ['d1', 'create', name, '--jurisdiction', 'eu']
    : ['kv', 'namespace', 'create', name, '--jurisdiction', 'eu']
}

function listIds(run) {
  const ids = new Map()
  for (const db of JSON.parse(run(['d1', 'list', '--json']))) ids.set(`d1:${db.name}`, db.uuid)
  for (const ns of JSON.parse(run(['kv', 'namespace', 'list']))) ids.set(`kv:${ns.title}`, ns.id)
  return ids
}

const keyOf = ({ kind, name }) => `${kind}:${name}`

export function provision(run) {
  let ids = listIds(run)
  const missing = RESOURCES.filter((r) => !ids.has(keyOf(r)))
  for (const resource of missing) run(createArgs(resource))
  if (missing.length) ids = listIds(run)

  const result = {}
  for (const resource of RESOURCES) {
    const id = ids.get(keyOf(resource))
    if (!id) throw new Error(`${resource.name} not found after creating it`)
    result[resource.env] ??= {}
    result[resource.env][resource.binding] = id
  }
  return result
}

function runWrangler(args) {
  return execFileSync(process.execPath, [WRANGLER, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const missing = missingVars(process.env)
  if (missing.length) {
    console.error(`Missing ${missing.join(' and ')}. Usage:
  CLOUDFLARE_API_TOKEN=<one-day token> CLOUDFLARE_ACCOUNT_ID=<id> node scripts/cloudflare/provision.mjs`)
    process.exit(1)
  }
  console.log(JSON.stringify(provision(runWrangler), null, 2))
}
