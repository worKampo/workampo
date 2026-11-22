import { sessions } from '@workampo/db/schema/global'
import { and, eq, isNull } from 'drizzle-orm'
import { globalDb } from '../db/d1-global-db'

// Queries are returned unawaited where a caller may put them in one batch() with other writes.
export function sessionRepo(env: { DB_GLOBAL: D1Database }) {
  const db = globalDb(env)
  return {
    findByTokenHash: (tokenHash: string) =>
      db
        .select({
          id: sessions.id,
          userId: sessions.userId,
          expiresAt: sessions.expiresAt,
          revokedAt: sessions.revokedAt,
        })
        .from(sessions)
        .where(eq(sessions.tokenHash, tokenHash))
        .get(),

    create: (session: typeof sessions.$inferInsert) => db.insert(sessions).values(session),

    revokeByTokenHash: (tokenHash: string, revokedAt: string) =>
      db
        .update(sessions)
        .set({ revokedAt })
        .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt))),
  }
}
