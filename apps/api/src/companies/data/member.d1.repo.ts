import { companies, members } from '@workampo/db/schema/global.d1'
import { and, eq, inArray } from 'drizzle-orm'
import { globalDb } from '../../_shared/db/d1-global-db'

export function memberRepo(env: { DB_GLOBAL: D1Database }) {
  const db = globalDb(env)

  return {
    // One query decides access: an inactive company and a suspended or leaving member find no row.
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
        .where(
          and(
            eq(companies.slug, slug),
            inArray(companies.status, ['active', 'trialing']),
            eq(members.userId, userId),
            eq(members.status, 'active'),
          ),
        )
        .get(),
  }
}
