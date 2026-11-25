import { companies, members } from '@workampo/db/schema/global.d1'
import { and, count, eq, inArray } from 'drizzle-orm'
import { globalDb } from '../../_shared/db/d1-global-db'

// The one rule of access, shared by requireMember and the list so they cannot drift: an inactive
// company and a suspended or leaving member find no row.
const activeMembership = (userId: string) =>
  and(
    inArray(companies.status, ['active', 'trialing']),
    eq(members.userId, userId),
    eq(members.status, 'active'),
  )

export function memberRepo(env: { DB_GLOBAL: D1Database }) {
  const db = globalDb(env)

  return {
    findActiveMembership: ({ slug, userId }: { slug: string; userId: string }) =>
      db
        .select({
          tenantId: companies.id,
          slug: companies.slug,
          name: companies.name,
          shardId: companies.shardId,
          memberId: members.id,
        })
        .from(companies)
        .innerJoin(members, eq(members.tenantId, companies.id))
        .where(and(eq(companies.slug, slug), activeMembership(userId)))
        .get(),

    listActiveCompanies: async (
      userId: string,
      { page, pageSize }: { page: number; pageSize: number },
    ) => {
      const [rows, [counted]] = await db.batch([
        db
          .select({ name: companies.name, slug: companies.slug })
          .from(members)
          .innerJoin(companies, eq(companies.id, members.tenantId))
          .where(activeMembership(userId))
          .orderBy(companies.name, companies.id)
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db
          .select({ total: count() })
          .from(members)
          .innerJoin(companies, eq(companies.id, members.tenantId))
          .where(activeMembership(userId)),
      ])

      return { rows, total: counted?.total ?? 0 }
    },
  }
}
