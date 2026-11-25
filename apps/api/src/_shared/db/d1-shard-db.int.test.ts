import { env } from 'cloudflare:workers'
import { sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { shardDb } from './d1-shard-db'

// A sync throw counts as a refusal.
function refusal(bindingName: string, bindings: object = env) {
  return expect(Promise.resolve().then(() => shardDb(bindings, bindingName))).rejects.toThrow()
}

describe('shardDb', () => {
  it('@id:companies-90-1 gives a client of the DB_SHARD_<n> binding it names', async () => {
    await env.DB_SHARD_1.exec("CREATE TABLE probe (v TEXT); INSERT INTO probe VALUES ('shard-1')")

    const db = shardDb(env, 'DB_SHARD_1')

    expect(await db.all(sql`SELECT v FROM probe`)).toEqual([{ v: 'shard-1' }])
  })

  it('@id:companies-90-12 fails closed for DB_GLOBAL, an absent shard and any other name', async () => {
    for (const name of [
      'DB_GLOBAL',
      'DB_SHARD_9',
      'DB_SHARD_',
      'DB_SHARD_01',
      'db_shard_1',
      'DB_SHARD_1 ',
      'DB_SHARD_1;DROP',
      'LANDINGS',
      '',
    ])
      await refusal(name)
  })

  it('@id:companies-90-12 never falls back to shard 1 when the named binding is missing', async () => {
    const { DB_SHARD_1, DB_GLOBAL } = env

    // DB_SHARD_2 is a valid name, but this environment has no such binding.
    await refusal('DB_SHARD_2', { DB_SHARD_1, DB_GLOBAL })
    await refusal('DB_SHARD_1', { DB_GLOBAL })
  })
})
