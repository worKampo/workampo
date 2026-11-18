import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resetStg, wipeSql } from './reset-stg.mjs'

const CONFIG = `{
  "env": {
    "stg": { "d1_databases": [
      { "binding": "DB_GLOBAL", "database_name": "global-stg" },
      { "binding": "DB_SHARD_1", "database_name": "shard-1-stg" }
    ] }
  }
}`

function fakeIo({ env = { GITHUB_ACTIONS: 'true' }, tables = [], files = {} } = {}) {
  const calls = []
  return {
    calls,
    io: {
      env,
      log: () => {},
      readConfig: () => CONFIG,
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
  for (const tables of [[], ['d1_migrations']]) {
    const { io, calls } = fakeIo({ tables })
    resetStg([], io)
    assert.deepEqual(
      calls.map((args) => args.slice(0, 2).join(' ')),
      ['d1 execute', 'd1 migrations', 'd1 execute', 'd1 migrations'],
    )
    for (const args of calls) assert.ok(args.join(' ').includes('--env stg --remote'))
  }
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
