import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resetStg, wipeSql } from './reset-stg.mjs'

const configWith = (prodId) => `{
  "d1_databases": [{ "binding": "DB_GLOBAL", "database_name": "global-local", "database_id": "local-g" }],
  "env": {
    "stg": { "d1_databases": [
      { "binding": "DB_GLOBAL", "database_name": "global-stg", "database_id": "stg-g" },
      { "binding": "DB_SHARD_1", "database_name": "shard-1-stg", "database_id": "stg-s" }
    ] },
    "prod": { "d1_databases": [
      { "binding": "DB_GLOBAL", "database_name": "global-prod", "database_id": "${prodId}" }
    ] }
  }
}`
const CONFIG = configWith('prod-g')

function fakeIo({
  env = { GITHUB_ACTIONS: 'true' },
  tables = [],
  files = {},
  config = CONFIG,
} = {}) {
  const calls = []
  return {
    calls,
    io: {
      env,
      log: () => {},
      readConfig: () => config,
      seedFiles: (kind) => files[kind] ?? [],
      wrangler: (args) => {
        calls.push(args)
        return args.includes('--json')
          ? JSON.stringify([{ results: tables.map((name) => ({ name })) }])
          : ''
      },
    },
  }
}

test('refuses before any call when an env.stg database has a production id', () => {
  for (const config of [configWith('stg-s'), CONFIG.replace('"local-g"', '"stg-g"')]) {
    const { io, calls } = fakeIo({ config })
    assert.throws(() => resetStg([], io), /database_id of a non-staging database/)
    assert.deepEqual(calls, [])
  }
})

test('refuses outside GitHub Actions and any target other than stg', () => {
  for (const [argv, env] of [
    [[], {}],
    [['prod'], { GITHUB_ACTIONS: 'true' }],
    [['--env', 'prod'], { GITHUB_ACTIONS: 'true' }],
    [[], { GITHUB_ACTIONS: 'true', CLOUDFLARE_ENV: 'prod' }],
    [[], { GITHUB_ACTIONS: 'true', ENVIRONMENT: 'prod' }],
  ]) {
    const { io, calls } = fakeIo({ env })
    assert.throws(() => resetStg(argv, io))
    assert.deepEqual(calls, [])
  }
})

test('with no tables it drops nothing but still applies migrations, so a failed reset resumes', () => {
  const { io, calls } = fakeIo({ files: { global: ['/g/1.sql'] } })
  resetStg([], io)
  assert.deepEqual(calls.slice(1), [
    ['d1', 'migrations', 'apply', 'global-stg', '--env', 'stg', '--remote'],
    ['d1', 'execute', 'global-stg', '--env', 'stg', '--remote', '--file', '/g/1.sql'],
    calls[3],
    ['d1', 'migrations', 'apply', 'shard-1-stg', '--env', 'stg', '--remote'],
  ])
  assert.ok(calls[3].includes('--json') && calls[3].includes('shard-1-stg'))
})

test('a reset that failed after the drop migrates again before seeding on the rerun', () => {
  const { io, calls } = fakeIo({ tables: ['members'], files: { global: ['/g/1.sql'] } })
  const wrangler = io.wrangler
  io.wrangler = (args) => {
    if (args[1] === 'migrations') throw new Error('apply failed')
    return wrangler(args)
  }
  assert.throws(() => resetStg([], io), /apply failed/)
  const rerun = fakeIo({ files: { global: ['/g/1.sql'] } })
  resetStg([], rerun.io)
  const global = rerun.calls.filter((args) => args.includes('global-stg')).map((a) => a[1])
  assert.deepEqual(global, ['execute', 'migrations', 'execute'])
  assert.ok(calls.some((args) => args.includes('--command') && !args.includes('--json')))
})

test('a lone d1_migrations is dropped, so the migrations rebuild what it recorded', () => {
  const { io, calls } = fakeIo({ tables: ['d1_migrations'] })
  resetStg([], io)
  assert.ok(calls.some((args) => args.includes(wipeSql(['d1_migrations']))))
})

test('drops the tables, re-applies migrations and seeds', () => {
  const { io, calls } = fakeIo({
    tables: ['d1_migrations', 'members'],
    files: { shard: ['/s/1.sql'] },
  })
  resetStg([], io)
  const shard = calls.filter((args) => args.includes('shard-1-stg'))
  assert.deepEqual(shard.slice(1), [
    [
      'd1',
      'execute',
      'shard-1-stg',
      '--env',
      'stg',
      '--remote',
      '--command',
      wipeSql(['d1_migrations', 'members']),
    ],
    ['d1', 'migrations', 'apply', 'shard-1-stg', '--env', 'stg', '--remote'],
    ['d1', 'execute', 'shard-1-stg', '--env', 'stg', '--remote', '--file', '/s/1.sql'],
  ])
  assert.match(wipeSql(['members']), /defer_foreign_keys[\s\S]*DROP TABLE "members"/)
})
