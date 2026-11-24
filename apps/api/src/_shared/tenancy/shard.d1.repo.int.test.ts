import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'

// shard.d1.repo.ts arrives with the tenancy seam task; a non-literal path keeps typecheck green
// until then. Once it exists, import it statically.
const SHARD_REPO: string = './shard.d1.repo'
// Only _shared/db/ and repos import drizzle: the client is checked by the binding it wraps.
type ShardClient = { $client: unknown }
type ShardClientOf = (bindings: object, shardId: string) => Promise<ShardClient> | ShardClient

async function loadShardClient() {
  const module: { shardClient: ShardClientOf } = await import(SHARD_REPO)

  return module.shardClient
}

async function shardClient(shardId: string) {
  return (await loadShardClient())(env, shardId)
}

// Loaded first, so a missing module never passes for a refusal; a sync throw counts as one.
async function refusal(shardId: string) {
  const load = await loadShardClient()

  return expect(Promise.resolve().then(() => load(env, shardId))).rejects.toThrow()
}

// Each test its own shard id: the client caches rows per isolate.
async function insertShard(bindingName: string) {
  const id = `shard-test-${crypto.randomUUID()}`
  await env.DB_GLOBAL.prepare(
    "INSERT INTO shards (id, engine, binding_name, created_at) VALUES (?, 'd1', ?, '2026-11-24T00:00:00.000Z')",
  )
    .bind(id, bindingName)
    .run()

  return id
}

describe('shardClient', () => {
  it('@id:companies-90-1 the migrations leave shard-1 on the d1 engine and DB_SHARD_1, with no credentials', async () => {
    const rows = await env.DB_GLOBAL.prepare('SELECT * FROM shards').all()

    expect(rows.results).toEqual([
      { id: 'shard-1', engine: 'd1', binding_name: 'DB_SHARD_1', created_at: expect.any(String) },
    ])
  })

  it.fails('@id:companies-90-1 gives the client of the binding the shard row names', async () => {
    const db = await shardClient('shard-1')

    expect(db.$client).toBe(env.DB_SHARD_1)
  })

  it.fails('@id:companies-90-12 fails closed for a shard with no row', async () => {
    await refusal('shard-404')
  })

  it.fails('@id:companies-90-12 fails closed when the row names DB_GLOBAL or a binding this environment lacks', async () => {
    const pointsAtGlobal = await insertShard('DB_GLOBAL')
    const pointsNowhere = await insertShard('DB_SHARD_7')

    await refusal(pointsAtGlobal)
    await refusal(pointsNowhere)
  })

  it('@id:companies-90-12 a shard engine other than d1 cannot be stored', async () => {
    const writing = env.DB_GLOBAL.prepare(
      "INSERT INTO shards (id, engine, binding_name, created_at) VALUES ('shard-pg', 'postgres', 'DB_SHARD_2', '2026-11-24T00:00:00.000Z')",
    ).run()

    await expect(writing).rejects.toThrow(/CHECK/)
  })
})
