import { rateLimitCounters } from '@workampo/db/schema/global'
import { sql } from 'drizzle-orm'
import { globalDb } from '../db/d1-global-db'

export function rateLimitRepo(env: { DB_GLOBAL: D1Database }) {
  const db = globalDb(env)
  return {
    // One atomic upsert: concurrent hits never lose a count.
    async increment(counter: { key: string; windowStartedAt: string; expiresAt: string }) {
      const [row] = await db
        .insert(rateLimitCounters)
        .values({ ...counter, count: 1 })
        .onConflictDoUpdate({
          target: [rateLimitCounters.key, rateLimitCounters.windowStartedAt],
          set: { count: sql`${rateLimitCounters.count} + 1` },
        })
        .returning({ count: rateLimitCounters.count })
      if (!row) throw new Error('the counter upsert returned no row')
      return row.count
    },
  }
}
