import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createArgs, missingVars, provision, RESOURCES } from './provision.mjs'

function fakeWrangler(existing = []) {
  const created = new Set(existing)
  const calls = []
  const run = (args) => {
    calls.push(args)
    const command = args.slice(0, 3).join(' ')
    if (command === 'd1 list --json')
      return JSON.stringify(
        RESOURCES.filter((r) => r.kind === 'd1' && created.has(r.name)).map((r) => ({
          name: r.name,
          uuid: `uuid-${r.name}`,
        })),
      )
    if (command === 'kv namespace list')
      return JSON.stringify(
        RESOURCES.filter((r) => r.kind === 'kv' && created.has(r.name)).map((r) => ({
          title: r.name,
          id: `id-${r.name}`,
        })),
      )
    created.add(args.find((a) => /-(stg|prod)$/.test(a)))
    return ''
  }
  return { run, calls }
}

test('names each missing variable', () => {
  assert.deepEqual(missingVars({}), ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'])
  assert.deepEqual(missingVars({ CLOUDFLARE_API_TOKEN: 'x' }), ['CLOUDFLARE_ACCOUNT_ID'])
  assert.deepEqual(missingVars({ CLOUDFLARE_API_TOKEN: 'x', CLOUDFLARE_ACCOUNT_ID: 'y' }), [])
})

test('every create carries the EU jurisdiction', () => {
  for (const resource of RESOURCES) {
    const args = createArgs(resource)
    assert.deepEqual(args.slice(-2), ['--jurisdiction', 'eu'], resource.name)
  }
})

test('creates only what is missing and prints the IDs per environment', () => {
  const { run, calls } = fakeWrangler(['global-stg', 'landings-prod'])
  const ids = provision(run)

  const creates = calls.filter((args) => args.includes('create'))
  assert.equal(creates.length, 4)
  for (const args of creates.filter((a) => a[0] === 'd1'))
    assert.deepEqual(args.slice(-2), ['--jurisdiction', 'eu'])
  assert.deepEqual(ids, {
    stg: {
      DB_GLOBAL: 'uuid-global-stg',
      DB_SHARD_1: 'uuid-shard-1-stg',
      LANDINGS: 'id-landings-stg',
    },
    prod: {
      DB_GLOBAL: 'uuid-global-prod',
      DB_SHARD_1: 'uuid-shard-1-prod',
      LANDINGS: 'id-landings-prod',
    },
  })
})

test('a second run creates nothing', () => {
  const { run, calls } = fakeWrangler(RESOURCES.map((r) => r.name))
  provision(run)
  assert.equal(calls.filter((args) => args.includes('create')).length, 0)
})
