import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  affectedWorkers,
  d1Databases,
  deploy,
  deployMessage,
  githubOutput,
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
  tip = SHA,
  affectedAfter = [],
  onMaster = true,
  shallow = false,
  mergeBaseStatus = 1,
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
      if (command === 'git' && args[0] === 'rev-parse' && args[1] === '--verify') return `${tip}\n`
      if (command === 'git' && args[0] === 'rev-parse' && args[1] === '--is-shallow-repository')
        return `${shallow}\n`
      if (command === 'git' && args[0] === 'rev-parse') return `${SHA}\n`
      if (command === 'git' && args[0] === 'merge-base' && !onMaster)
        throw Object.assign(new Error(`exit ${mergeBaseStatus}`), { status: mergeBaseStatus })
      if (command === 'git' && args[0] === 'log') return `${subject}\n`
      if (command === 'turbo') {
        const names = args.includes(`...[${SHA}...${tip}]`) ? affectedAfter : affected
        return JSON.stringify({ packages: { items: names.map((name) => ({ name })) } })
      }
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
  assert.deepEqual(parseArgs(['stg']), { env: 'stg', all: false, allowStale: false })
  assert.deepEqual(parseArgs(['prod', '--all']), { env: 'prod', all: true, allowStale: false })
  assert.deepEqual(parseArgs(['stg', '--allow-stale']), {
    env: 'stg',
    all: false,
    allowStale: true,
  })
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
  assert.deepEqual(await deploy({ env: 'stg', all: false }, io), {
    workers: [],
    from: DEPLOYED,
    current: true,
  })
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

test('a /health sha that is not a full lowercase SHA counts as no deployed SHA', async () => {
  const bad = ['master~3', DEPLOYED.toUpperCase(), 'ffffff', 123, `${DEPLOYED}\n`, {}, '']
  for (const deployed of bad) {
    const { io, calls } = fakeIo({ deployed })
    assert.deepEqual(await deploy({ env: 'stg', all: false }, io), { workers: WORKERS, from: '' })
    assert.equal(calls.filter((c) => c.command === 'turbo').length, 0)
    assert.equal(calls.filter((c) => c.args.includes('cat-file')).length, 0)
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

const TIP = 'cccccccccccccccccccccccccccccccccccccccc'
const deploysOf = (calls) => calls.filter((c) => c.command === 'wrangler' && c.args[0] === 'deploy')

test('HEAD at the tip of master deploys without asking turbo about later commits', async () => {
  const { io, calls } = fakeIo()
  assert.deepEqual(await deploy({ env: 'prod', all: true }, io), { workers: WORKERS, from: '' })
  assert.ok(calls.some((c) => c.args[0] === 'fetch'))
  assert.ok(!calls.some((c) => ['ls-remote', 'merge-base'].includes(c.args[0])))
  // With --all nothing asks turbo; a later-commit query would also show up here.
  assert.ok(!calls.some((c) => c.command === 'turbo'))
  assert.equal(deploysOf(calls).length, 2)
})

test('later commits on master that affect no Worker do not make the run stale', async () => {
  const { io, calls } = fakeIo({ tip: TIP, affectedAfter: [] })
  assert.deepEqual(await deploy({ env: 'prod', all: false }, io), {
    workers: WORKERS,
    from: DEPLOYED,
  })
  // The tip is read from the ref this fetch wrote, never from a separate ls-remote.
  assert.deepEqual(calls.find((c) => c.args[0] === 'fetch').args, [
    'fetch',
    '--no-tags',
    'origin',
    '+refs/heads/master:refs/deploy/master-tip',
  ])
  assert.ok(
    calls.some((c) => c.args[1] === '--verify' && c.args[2] === 'refs/deploy/master-tip^{commit}'),
  )
  assert.ok(!calls.some((c) => c.args[0] === 'ls-remote'))
  assert.ok(calls.some((c) => c.command === 'turbo' && c.args.includes(`...[${SHA}...${TIP}]`)))
  assert.equal(deploysOf(calls).length, 2)
})

test('a later commit on master that affects a Worker makes the run stale, on every path', async () => {
  for (const [options, all] of [
    [{}, false],
    [{ deployed: null }, false],
    [{}, true],
  ]) {
    const { io, calls } = fakeIo({ ...options, tip: TIP, affectedAfter: ['@workampo/api'] })
    assert.deepEqual(await deploy({ env: 'prod', all }, io), { workers: [], from: '' })
    assert.ok(!calls.some((c) => c.command === 'wrangler'))
  }
})

test('a SHA that is not on master is stale', async () => {
  const { io, calls } = fakeIo({ tip: TIP, onMaster: false })
  assert.deepEqual(await deploy({ env: 'prod', all: true }, io), { workers: [], from: '' })
  assert.ok(!calls.some((c) => c.command === 'wrangler'))
})

test('a master tip the fetch cannot resolve fails instead of guessing', async () => {
  const { io } = fakeIo({ tip: TIP })
  const run = io.run
  io.run = (command, args) => {
    if (args[1] === '--verify') throw new Error('fatal: Needed a single revision')
    return run(command, args)
  }
  await assert.rejects(deploy({ env: 'prod', all: true }, io), /single revision/)
})

test('a shallow clone fails instead of calling every run stale', async () => {
  const { io, calls } = fakeIo({ tip: TIP, shallow: true })
  await assert.rejects(deploy({ env: 'prod', all: true }, io), /shallow.*fetch-depth: 0/)
  assert.ok(!calls.some((c) => c.args[0] === 'merge-base' || c.command === 'wrangler'))
})

test('a git error in merge-base fails; only exit code 1 means not on master', async () => {
  const { io, calls } = fakeIo({ tip: TIP, onMaster: false, mergeBaseStatus: 128 })
  await assert.rejects(deploy({ env: 'prod', all: true }, io), /exit 128/)
  assert.ok(!calls.some((c) => c.command === 'wrangler'))
})

test('--allow-stale deploys even when a later commit affects a Worker', async () => {
  const { io, calls } = fakeIo({ tip: TIP, affectedAfter: ['@workampo/api'] })
  assert.deepEqual(await deploy({ env: 'prod', all: true, allowStale: true }, io), {
    workers: WORKERS,
    from: '',
  })
  assert.ok(!calls.some((c) => ['ls-remote', 'fetch'].includes(c.args[0])))
  assert.equal(calls.filter((c) => c.command === 'wrangler').length, 3)
})

const githubOutputOf = async (options, io) => githubOutput(await deploy(options, io))

test('--allow-stale skips the staleness check, so it never outputs observe=none', async () => {
  const { io } = fakeIo({ affected: [] })
  assert.equal(
    await githubOutputOf({ env: 'stg', all: false, allowStale: true }, io),
    `deployed=false\nfrom=${DEPLOYED}\n`,
  )
})

test('E1: a current run with no Worker affected outputs observe=none', async () => {
  const { io } = fakeIo({ affected: [] })
  assert.equal(
    await githubOutputOf({ env: 'stg', all: false }, io),
    `deployed=false\nfrom=${DEPLOYED}\nobserve=none\n`,
  )
})

test('E1: later master commits that affect no Worker keep the run current', async () => {
  const { io } = fakeIo({ affected: [], tip: TIP, affectedAfter: [] })
  assert.equal(
    await githubOutputOf({ env: 'stg', all: false }, io),
    `deployed=false\nfrom=${DEPLOYED}\nobserve=none\n`,
  )
})

test('E2: a run that deploys a Worker outputs nothing new', async () => {
  for (const [options, all, from] of [
    [{}, false, DEPLOYED],
    [{ deployed: null }, false, ''],
    [{ affected: [] }, true, ''],
  ]) {
    const { io } = fakeIo(options)
    assert.equal(await githubOutputOf({ env: 'stg', all }, io), `deployed=true\nfrom=${from}\n`)
  }
})

test('E4: a stale run outputs nothing new, even with no Worker affected', async () => {
  for (const options of [
    { affected: [], tip: TIP, affectedAfter: ['@workampo/api'] },
    { affected: [], tip: TIP, onMaster: false },
  ]) {
    const { io } = fakeIo(options)
    assert.equal(await githubOutputOf({ env: 'stg', all: false }, io), 'deployed=false\nfrom=\n')
  }
})
