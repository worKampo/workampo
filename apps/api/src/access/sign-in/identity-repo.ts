import { identities, users } from '@workampo/db/schema/global'
import type { VerifiedIdentity } from '@workampo/domain/_shared/identity'
import { and, eq } from 'drizzle-orm'
import { globalDb } from '../../_shared/db/d1-global-db'

export function identityRepo(env: { DB_GLOBAL: D1Database }) {
  const db = globalDb(env)

  return {
    findUser: ({ provider, subject }: Pick<VerifiedIdentity, 'provider' | 'subject'>) =>
      db
        .select({ id: users.id, email: users.email })
        .from(identities)
        .innerJoin(users, eq(users.id, identities.userId))
        .where(and(eq(identities.provider, provider), eq(identities.subject, subject)))
        .get(),

    create: (identity: typeof identities.$inferInsert) => db.insert(identities).values(identity),
  }
}
