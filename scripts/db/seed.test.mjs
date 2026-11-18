import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseArgs, seed } from './seed.mjs'

const LOCAL_CONFIG = `{
  // Top level is local only.
  "d1_databases": [
    { "binding": "DB_GLOBAL", "database_name": "global-local", "database_id": "local-global" },
    { "binding": "DB_SHARD_1", "database_name": "shard-1-local", "database_id": "local-shard-1" }
  ],
  "env": { "prod": { "d1_databases": [{ "binding": "DB_GLOBAL", "database_name": "global-prod" }] } }
}`

function fakeIo({ env = {}, config = LOCAL_CONFIG, files = {} } = {}) {
  const calls = []
  const logs = []
  return {
    calls,
    logs,
    io: {
      env,
      log: (line) => logs.push(line),
      readConfig: () => config,
      seedFiles: (kind) => files[kind] ?? [],
      wrangler: (args) => calls.push(args),
    },
  }
}

test('refuses a production-like config before any wrangler call', () => {
  const files = { global: ['/seed/global/001.sql'] }
  const prodConfig = LOCAL_CONFIG.replace(
    '"local-global"',
    '"e8fe587d-c9de-427b-ade8-18d7e5211946"',
  )
  for (const { env, config } of [
    { env: { ENVIRONMENT: 'prod' } },
    { env: { ENVIRONMENT: 'stg' } },
    { env: { CLOUDFLARE_ENV: 'prod' } },
    { config: prodConfig },
    { config: LOCAL_CONFIG.replace('global-local', 'global-prod') },
  ]) {
    const { io, calls } = fakeIo({ env, config, files })
    assert.throws(() => seed({}, io), /only runs against local|refusing to seed/)
    assert.deepEqual(calls, [])
  }
})

test('takes no environment, database or --remote from the caller', () => {
  assert.deepEqual(parseArgs([]), {})
  for (const argv of [['--remote'], ['--env', 'prod'], ['global-prod'], ['--persist-to']])
    assert.throws(() => parseArgs(argv), /Unknown argument/)
  assert.match(parseArgs(['--persist-to', '.wrangler/e2e']).persistTo, /e2e$/)
})

test('runs every seed file in order with --local', () => {
  const files = { global: ['/g/001.sql', '/g/002.sql'], shard: ['/s/001.sql'] }
  const { io, calls } = fakeIo({ env: { ENVIRONMENT: 'local' }, files })
  seed({ persistTo: '/tmp/state' }, io)
  assert.deepEqual(calls, [
    [
      'd1',
      'execute',
      'global-local',
      '--local',
      '--file',
      '/g/001.sql',
      '--persist-to',
      '/tmp/state',
    ],
    [
      'd1',
      'execute',
      'global-local',
      '--local',
      '--file',
      '/g/002.sql',
      '--persist-to',
      '/tmp/state',
    ],
    [
      'd1',
      'execute',
      'shard-1-local',
      '--local',
      '--file',
      '/s/001.sql',
      '--persist-to',
      '/tmp/state',
    ],
  ])
})

test('says there is nothing to seed when there are no files', () => {
  const { io, calls, logs } = fakeIo()
  seed({}, io)
  assert.deepEqual(calls, [])
  assert.match(logs.join('\n'), /nothing to seed/)
})
