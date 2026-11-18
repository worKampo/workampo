// The only way to deploy, by hand and from CI (ADR-0013):
//   node scripts/deploy/deploy.mjs <stg|prod> [--all] [--allow-stale]
// Wrangler reads CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID; source maps need SENTRY_AUTH_TOKEN,
// SENTRY_ORG and SENTRY_PROJECT. Tokens are only passed to child processes through the environment.
import { execFileSync } from 'node:child_process'
import { appendFileSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parse } from 'yaml'
import { parsePrNumber } from '../smoke/verification-comment.mjs'

export const ENVIRONMENTS = ['stg', 'prod']
export const WORKERS = [{ package: '@workampo/api', dir: 'apps/api' }]

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const SENTRY_URL = 'https://de.sentry.io'
const HEALTH_TIMEOUT_MS = 10 * 1000
const USAGE = 'Usage: node scripts/deploy/deploy.mjs <stg|prod> [--all] [--allow-stale]'
const FLAGS = ['--all', '--allow-stale']

export function parseArgs(argv) {
  const [env, ...rest] = argv
  if (!ENVIRONMENTS.includes(env)) throw new Error(`Missing or unknown environment. ${USAGE}`)
  if (rest.some((arg) => !FLAGS.includes(arg))) throw new Error(`Unknown argument. ${USAGE}`)
  return { env, all: rest.includes('--all'), allowStale: rest.includes('--allow-stale') }
}

export function affectedWorkers(affectedPackages, workers) {
  return workers.filter((worker) => affectedPackages.includes(worker.package))
}

export function deployMessage(sha, subject) {
  const short = sha.slice(0, 7)
  const pr = parsePrNumber(subject)
  return pr ? `#${pr} ${short}` : short
}

export function stripJsonComments(text) {
  return text.replace(
    /("(?:\\.|[^"\\])*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g,
    (_, string) => string ?? '',
  )
}

export function d1Databases(wranglerJsonc, env) {
  const block = JSON.parse(stripJsonComments(wranglerJsonc)).env?.[env]
  if (!block) throw new Error(`wrangler.jsonc has no env.${env} block`)
  return (block.d1_databases ?? []).map((db) => db.database_name)
}

async function selectWorkers(env, sha, io) {
  const deployed = await io.deployedSha(env)
  if (!deployed || !isKnownCommit(deployed, io)) {
    io.log(`No deployed SHA known in ${env}: deploying every Worker.`)
    return { workers: WORKERS, from: '' }
  }
  io.log(`${env} serves ${deployed}; target is ${sha}.`)
  const listing = JSON.parse(
    io.run('turbo', ['ls', '--filter', `...[${deployed}...${sha}]`, '--output', 'json']),
  )
  const workers = affectedWorkers(
    listing.packages.items.map((item) => item.name),
    WORKERS,
  )
  return { workers, from: deployed }
}

function isKnownCommit(sha, io) {
  try {
    io.run('git', ['cat-file', '-e', `${sha}^{commit}`])
    return true
  } catch {
    return false
  }
}

function deployWorker(worker, env, sha, message, io) {
  const cwd = join(ROOT, worker.dir)
  const wrangler = (args) => io.run('wrangler', args, { cwd })

  for (const db of d1Databases(io.readFile(join(cwd, 'wrangler.jsonc')), env))
    wrangler(['d1', 'migrations', 'apply', db, '--env', env, '--remote'])

  // --upload-source-maps only makes the dry run write the .map files; nothing is uploaded.
  wrangler(['deploy', '--dry-run', '--env', env, '--outdir', 'dist', '--upload-source-maps'])
  uploadSourceMaps(cwd, sha, io)
  io.removeMaps(join(cwd, 'dist'))

  // Deploy the built bundle, not a rebuild, so it carries the debug IDs Sentry received.
  wrangler([
    'deploy',
    'dist/index.js',
    '--no-bundle',
    '--config',
    'wrangler.jsonc',
    '--env',
    env,
    '--tag',
    sha,
    '--message',
    message,
    '--var',
    `GIT_SHA:${sha}`,
    // Passed on every deploy: a `wrangler secret put` would create an untagged version and lose the SHA.
    // The DSN only lets a client send events, so Sentry documents it as safe to expose.
    ...(io.env.SENTRY_DSN ? ['--var', `SENTRY_DSN:${io.env.SENTRY_DSN}`] : []),
  ])
}

function uploadSourceMaps(cwd, sha, io) {
  if (!io.env.SENTRY_AUTH_TOKEN) {
    io.log('SENTRY_AUTH_TOKEN is not set: source maps are not uploaded to Sentry.')
    return
  }
  const missing = ['SENTRY_ORG', 'SENTRY_PROJECT'].filter((name) => !io.env[name])
  if (missing.length) throw new Error(`Missing ${missing.join(' and ')} for the Sentry upload`)
  const env = { ...io.env, SENTRY_URL }
  io.run('sentry-cli', ['sourcemaps', 'inject', 'dist'], { cwd, env })
  io.run('sentry-cli', ['sourcemaps', 'upload', '--release', sha, 'dist'], { cwd, env })
}

// `from` is the SHA the environment served before the deploy, or '' when unknown.
export async function deploy({ env, all, allowStale = false }, io) {
  const sha = io.run('git', ['rev-parse', 'HEAD']).trim()
  // Runs of older pushes can start late: only the tip of master may deploy, or it would roll back a newer one.
  if (!allowStale) {
    io.run('git', ['fetch', 'origin', 'master'])
    const tip = io.run('git', ['rev-parse', 'FETCH_HEAD']).trim()
    if (tip !== sha) {
      io.log(
        `origin/master is at ${tip}, not ${sha}: a newer commit is on master and its own run deploys it. Nothing deployed.`,
      )
      return { workers: [], from: '' }
    }
  }
  const { workers, from } = all ? { workers: WORKERS, from: '' } : await selectWorkers(env, sha, io)
  if (!workers.length) {
    io.log(`No Worker is affected since the deployed SHA: nothing to deploy to ${env}.`)
    return { workers, from }
  }
  const message = deployMessage(sha, io.run('git', ['log', '-1', '--format=%s']).trim())
  for (const worker of workers) {
    io.log(`Deploying ${worker.package} to ${env} (${message}).`)
    deployWorker(worker, env, sha, message, io)
  }
  return { workers, from }
}

const require = createRequire(import.meta.url)
const BINARIES = {
  git: () => ['git'],
  turbo: () => [process.execPath, require.resolve('turbo/bin/turbo')],
  'sentry-cli': () => [process.execPath, require.resolve('@sentry/cli/bin/sentry-cli')],
  // Wrangler is a dependency of each Worker, not of the root workspace.
  wrangler: (cwd) => [
    process.execPath,
    join(cwd, 'node_modules', 'wrangler', 'bin', 'wrangler.js'),
  ],
}

function run(command, args, { cwd = ROOT, env = process.env } = {}) {
  const [file, ...prefix] = BINARIES[command](cwd)
  const isCaptured = command === 'git' || command === 'turbo'
  return execFileSync(file, [...prefix, ...args], {
    cwd,
    env,
    encoding: 'utf8',
    stdio: ['ignore', isCaptured ? 'pipe' : 'inherit', isCaptured ? 'pipe' : 'inherit'],
  })
}

async function deployedSha(env) {
  const { url } = parse(readFileSync(join(ROOT, 'project.yaml'), 'utf8')).environments[env]
  try {
    const response = await fetch(`${url.replace(/\/+$/, '')}/health`, {
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    })
    if (response.status !== 200) return null
    return (await response.json())?.sha ?? null
  } catch {
    return null
  }
}

function removeMaps(dir) {
  for (const file of readdirSync(dir, { recursive: true }))
    if (file.endsWith('.map')) rmSync(join(dir, file))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let args
  try {
    args = parseArgs(process.argv.slice(2))
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
  const { workers, from } = await deploy(args, {
    run,
    deployedSha,
    removeMaps,
    readFile: (path) => readFileSync(path, 'utf8'),
    env: process.env,
    log: console.log,
  })
  // The workflow skips the smoke and the comment when nothing was deployed.
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, `deployed=${workers.length > 0}\nfrom=${from}\n`)
}
