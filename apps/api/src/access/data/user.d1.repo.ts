import { users } from '@workampo/db/schema/global.d1'
import { eq } from 'drizzle-orm'
import { globalDb } from '../../_shared/db/d1-global-db'

// Writes come back unawaited so a use case can put them in one batch() with other writes.
export function userRepo(env: { DB_GLOBAL: D1Database }) {
  const db = globalDb(env)

  return {
    findByEmail: (email: string) =>
      db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(eq(users.email, email))
        .get(),

    findById: (id: string) =>
      db.select({ id: users.id, email: users.email }).from(users).where(eq(users.id, id)).get(),

    create: (user: typeof users.$inferInsert) => db.insert(users).values(user),

    changeEmail: ({ id, email, updatedAt }: { id: string; email: string; updatedAt: string }) =>
      db.update(users).set({ email, updatedAt }).where(eq(users.id, id)),
  }
}
