import { shards } from '@workampo/db/schema/global.d1'
import { eq } from 'drizzle-orm'
import { globalDb } from '../db/d1-global-db'
import { shardDb } from '../db/d1-shard-db'

type ShardRow = Pick<typeof shards.$inferSelect, 'engine' | 'bindingName'>

// shortcut: rows cached per isolate, shards change only by migration and redeploy (ADR-0010); drop the cache when shards are added at runtime.
const rows = new Map<string, ShardRow>()

export async function shardClient(env: { DB_GLOBAL: D1Database }, shardId: string) {
  let row = rows.get(shardId)
  if (!row) {
    row = await globalDb(env)
      .select({ engine: shards.engine, bindingName: shards.bindingName })
      .from(shards)
      .where(eq(shards.id, shardId))
      .get()
    if (!row) throw new Error(`Unknown shard ${JSON.stringify(shardId)}`)
    rows.set(shardId, row)
  }
  if (row.engine !== 'd1') throw new Error(`Shard ${shardId} has engine ${row.engine}, not d1`)

  return shardDb(env, row.bindingName)
}
