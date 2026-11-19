import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { backfill, loadBackfill, parseArgs } from './backfill.mjs'

const FIXTURES = fileURLToPath(new URL('./fixtures/', import.meta.url))
const ROWS = ['01', '02', '03', '04', '05'].map((id) => ({ id, email: `User${id}@Example.com` }))
const CONFIG = `{
  "d1_databases": [
    { "binding": "DB_GLOBAL", "database_name": "global-local" },
    { "binding": "DB_SHARD_1", "database_name": "shard-1-local" }
  ],
  "env": { "stg": { "d1_databases": [{ "binding": "DB_SHARD_1", "database_name": "shard-1-stg" }] } }
}`

// A fake D1 that answers the fixture's select by reading its cursor and limit.
function fakeIo(env = {}) {
  const calls = []
  return {
    calls,
    io: {
      env,
      log: () => {},
      readConfig: () => CONFIG,
      load: (name) => loadBackfill(name, FIXTURES),
      wrangler: (args) => {
        calls.push(args)
        const sql = args.at(-1)
        if (!args.includes('--json')) return ''
        const after = sql.match(/id > '(\w+)'/)?.[1] ?? ''
        const limit = Number(sql.match(/LIMIT (\d+)/)[1])
        return JSON.stringify([{ results: ROWS.filter((row) => row.id > after).slice(0, limit) }])
      },
    },
  }
}

const updates = (calls) => calls.filter((args) => !args.includes('--json'))

test('runs in batches until the rows run out', async () => {
  const { io, calls } = fakeIo()
  const summary = await backfill(parseArgs(['example-backfill', '--batch', '2']), io)
  assert.deepEqual(summary, { 'shard-1-local': { batches: 3, rows: 5 } })
  assert.equal(updates(calls).length, 3)
  for (const args of calls) assert.deepEqual(args.slice(2, 4), ['shard-1-local', '--local'])
  assert.match(updates(calls)[0].at(-1), /'user01@example.com' WHERE id = '01'/)
})

test('resumes after a cursor', async () => {
  const { io, calls } = fakeIo()
  const summary = await backfill(
    parseArgs(['example-backfill', '--batch', '2', '--after', '03']),
    io,
  )
  assert.deepEqual(summary['shard-1-local'], { batches: 1, rows: 2 })
  assert.match(updates(calls)[0].at(-1), /WHERE id = '04'[\s\S]*WHERE id = '05'/)
})

test('a dry run selects but writes nothing', async () => {
  const { io, calls } = fakeIo()
  await backfill(parseArgs(['example-backfill', '--dry-run']), io)
  assert.deepEqual(updates(calls), [])
})

test('refuses remote environments outside GitHub Actions', async () => {
  for (const env of ['stg', 'prod']) {
    const { io, calls } = fakeIo()
    await assert.rejects(
      backfill(parseArgs(['example-backfill', '--env', env]), io),
      /GitHub Actions/,
    )
    assert.deepEqual(calls, [])
  }
  const { io, calls } = fakeIo({ GITHUB_ACTIONS: 'true' })
  await backfill(parseArgs(['example-backfill', '--env', 'stg']), io)
  assert.deepEqual(calls[0].slice(2, 6), ['shard-1-stg', '--env', 'stg', '--remote'])
})

test('rejects bad arguments and names', async () => {
  for (const argv of [
    [],
    ['../escape'],
    ['x', '--env', 'dev'],
    ['x', '--batch', '0'],
    ['x', '--remote'],
  ])
    assert.throws(() => parseArgs(argv))
  await assert.rejects(loadBackfill('missing', FIXTURES), /No backfill/)
})
