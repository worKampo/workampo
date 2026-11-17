import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  affectedWorkers,
  d1Databases,
  deploy,
  deployMessage,
  parseArgs,
  WORKERS,
} from './deploy.mjs'

const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678'
const DEPLOYED = 'ffffffffffffffffffffffffffffffffffffffff'

const SAMPLE_CONFIG = `{
  // Top level is local only.
  "$schema": "../../node_modules/wrangler/config-schema.json",
  "name": "app-local",
  "d1_databases": [{ "binding": "DB_GLOBAL", "database_name": "global-local" }],
  /* Each environment repeats its bindings. */
  "env": {
    "stg": {
      "vars": { "URL": "https://example.com/a//b" },
      "d1_databases": [
        { "binding": "DB_GLOBAL", "database_name": "global-stg" },
        { "binding": "DB_SHARD_1", "database_name": "shard-1-stg" }
      ]
    },
    "prod": { "d1_databases": [{ "binding": "DB_GLOBAL", "database_name": "global-prod" }] }
  }
}`

function fakeIo({
  deployed = DEPLOYED,
  affected = ['@workampo/api'],
  subject = 'feat: x (#12)',
  env = {},
} = {}) {
  const calls = []
  const io = {
    env,
    log: () => {},
    readFile: () => SAMPLE_CONFIG,
    removeMaps: (dir) => calls.push({ command: 'removeMaps', args: [dir] }),
    deployedSha: async () => deployed,
    run: (command, args) => {
      calls.push({ command, args })
      if (command === 'git' && args[0] === 'rev-parse') return `${SHA}\n`
      if (command === 'git' && args[0] === 'log') return `${subject}\n`
      if (command === 'turbo')
        return JSON.stringify({ packages: { items: affected.map((name) => ({ name })) } })
      return ''
    },
  }
  return { io, calls }
}

test('refuses without stg or prod', () => {
  assert.throws(() => parseArgs([]), /stg\|prod/)
  assert.throws(() => parseArgs(['local']), /stg\|prod/)
  assert.throws(() => parseArgs(['--all']), /stg\|prod/)
  assert.throws(() => parseArgs(['stg', '--force']), /Unknown argument/)
  assert.deepEqual(parseArgs(['stg']), { env: 'stg', all: false })
  assert.deepEqual(parseArgs(['prod', '--all']), { env: 'prod', all: true })
})

test('selects the Workers among the affected packages', () => {
  assert.deepEqual(affectedWorkers([], WORKERS), [])
  assert.deepEqual(affectedWorkers(['@workampo/api'], WORKERS), WORKERS)
  // Turbo's ...[sha] filter adds the dependents of a changed package.
  assert.deepEqual(affectedWorkers(['@workampo/domain', '@workampo/api'], WORKERS), WORKERS)
  assert.deepEqual(affectedWorkers(['@workampo/domain'], []), [])
})

test('deploy message carries the PR when the subject names one', () => {
  assert.equal(deployMessage(SHA, 'feat: deploy script (#12)'), '#12 a1b2c3d')
  assert.equal(deployMessage(SHA, 'chore: direct commit'), 'a1b2c3d')
  assert.equal(deployMessage(SHA, 'fix: see (#3) later'), 'a1b2c3d')
})

test('lists the D1 databases of one environment from wrangler.jsonc', () => {
  assert.deepEqual(d1Databases(SAMPLE_CONFIG, 'stg'), ['global-stg', 'shard-1-stg'])
  assert.deepEqual(d1Databases(SAMPLE_CONFIG, 'prod'), ['global-prod'])
  assert.throws(() => d1Databases(SAMPLE_CONFIG, 'qa'), /env\.qa/)
})

test('docs-only diff deploys nothing', async () => {
  const { io, calls } = fakeIo({ affected: [] })
  assert.deepEqual(await deploy({ env: 'stg', all: false }, io), { workers: [], from: DEPLOYED })
  assert.equal(calls.filter((c) => c.command === 'wrangler').length, 0)
  const turbo = calls.find((c) => c.command === 'turbo')
  assert.ok(turbo.args.includes(`...[${DEPLOYED}...${SHA}]`))
})

test('unreachable /health and --all deploy everything without asking turbo', async () => {
  for (const [options, all] of [
    [{ deployed: null }, false],
    [{ affected: [] }, true],
  ]) {
    const { io, calls } = fakeIo(options)
    assert.deepEqual(await deploy({ env: 'stg', all }, io), { workers: WORKERS, from: '' })
    assert.equal(calls.filter((c) => c.command === 'turbo').length, 0)
  }
})

test('a real deploy migrates, builds, strips maps and deploys, always with --env', async () => {
  const { io, calls } = fakeIo()
  assert.deepEqual(await deploy({ env: 'prod', all: false }, io), {
    workers: WORKERS,
    from: DEPLOYED,
  })

  const wrangler = calls.filter((c) => c.command === 'wrangler').map((c) => c.args)
  assert.equal(wrangler.length, 3)
  for (const args of wrangler) assert.equal(args[args.indexOf('--env') + 1], 'prod', args.join(' '))
  assert.deepEqual(wrangler[0], [
    'd1',
    'migrations',
    'apply',
    'global-prod',
    '--env',
    'prod',
    '--remote',
  ])
  assert.ok(wrangler[1].includes('--dry-run'))
  const last = wrangler.at(-1)
  assert.equal(last[last.indexOf('--tag') + 1], SHA)
  assert.equal(last[last.indexOf('--message') + 1], '#12 a1b2c3d')
  assert.equal(last[last.indexOf('--var') + 1], `GIT_SHA:${SHA}`)
  assert.ok(!last.includes('--dry-run'))

  const order = calls.map((c) => c.command)
  assert.ok(order.indexOf('removeMaps') < order.lastIndexOf('wrangler'))
  assert.equal(calls.filter((c) => c.command === 'sentry-cli').length, 0)
})

test('uploads source maps with release = SHA when the Sentry token is set', async () => {
  const { io, calls } = fakeIo({
    env: { SENTRY_AUTH_TOKEN: 't', SENTRY_ORG: 'o', SENTRY_PROJECT: 'p' },
  })
  await deploy({ env: 'stg', all: false }, io)
  const sentry = calls.filter((c) => c.command === 'sentry-cli').map((c) => c.args)
  assert.deepEqual(sentry, [
    ['sourcemaps', 'inject', 'dist'],
    ['sourcemaps', 'upload', '--release', SHA, 'dist'],
  ])
  const order = calls.map((c) => c.command)
  assert.ok(order.lastIndexOf('sentry-cli') < order.indexOf('removeMaps'))
})
