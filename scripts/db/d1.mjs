// Shared by the seed, staging reset and backfill scripts: Wrangler D1 calls with injected io for tests.
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripJsonComments } from '../deploy/deploy.mjs'

export const ROOT = fileURLToPath(new URL('../../', import.meta.url))
export const API_DIR = join(ROOT, 'apps', 'api')
export const SEED_DIR = join(ROOT, 'packages', 'db', 'seed')

// Bindings: DB_GLOBAL, and one DB_SHARD_<n> per shard.
const KINDS = { global: (binding) => binding === 'DB_GLOBAL', shard: (b) => /^DB_SHARD_/.test(b) }

export function d1Config(wranglerJsonc, env) {
  const config = JSON.parse(stripJsonComments(wranglerJsonc))
  const block = env === 'local' ? config : config.env?.[env]
  if (!block) throw new Error(`wrangler.jsonc has no env.${env} block`)
  return block.d1_databases ?? []
}

export function databaseNames(databases, kind) {
  if (!KINDS[kind]) throw new Error(`Unknown database kind "${kind}": use global or shard`)
  return databases.filter((db) => KINDS[kind](db.binding)).map((db) => db.database_name)
}

export function target(env) {
  return env === 'local' ? ['--local'] : ['--env', env, '--remote']
}

// ENVIRONMENT and CLOUDFLARE_ENV name the environment a process believes it is in; Wrangler reads the latter.
export function assertEnvVars(env, allowed) {
  for (const name of ['ENVIRONMENT', 'CLOUDFLARE_ENV'])
    if (env[name] && env[name] !== allowed)
      throw new Error(`${name}=${env[name]}: this command only runs against ${allowed}`)
}

export function assertInActions(env, what) {
  if (!env.GITHUB_ACTIONS) throw new Error(`${what} runs only in its GitHub Actions workflow`)
}

export function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'number' || typeof value === 'bigint') return String(value)
  return `'${String(value).replaceAll("'", "''")}'`
}

// The seed files of one kind, in name order so every run applies the same sequence.
export function seedFiles(kind, dir = SEED_DIR) {
  const folder = join(dir, kind)
  let names
  try {
    names = readdirSync(folder)
  } catch {
    return []
  }
  return names
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => join(folder, name))
}

export function parseRows(json) {
  return JSON.parse(json).flatMap((result) => result.results ?? [])
}

export function runWrangler(args, { capture = false } = {}) {
  // Every command names its target explicitly; an inherited CLOUDFLARE_ENV must not redirect it.
  const { CLOUDFLARE_ENV: _ignored, ...env } = process.env
  return execFileSync(
    process.execPath,
    [join(API_DIR, 'node_modules', 'wrangler', 'bin', 'wrangler.js'), ...args],
    {
      cwd: API_DIR,
      env,
      encoding: 'utf8',
      stdio: ['ignore', capture ? 'pipe' : 'inherit', 'inherit'],
    },
  )
}

export function realIo() {
  return {
    env: process.env,
    log: console.log,
    readConfig: () => readFileSync(join(API_DIR, 'wrangler.jsonc'), 'utf8'),
    seedFiles,
    wrangler: runWrangler,
  }
}

export async function main(fn) {
  try {
    await fn()
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}
