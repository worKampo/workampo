import { companies, companyCreationRequests, members } from '@workampo/db/schema/global.d1'
import { and, eq } from 'drizzle-orm'
import { globalDb } from '../../_shared/db/d1-global-db'

export function companyCreationRequestRepo(env: { DB_GLOBAL: D1Database }) {
  const db = globalDb(env)

  return {
    // The company a request created, with what a retry needs to finish it in the shard.
    find: ({ userId, idempotencyKey }: { userId: string; idempotencyKey: string }) =>
      db
        .select({
          bodyHash: companyCreationRequests.bodyHash,
          tenantId: companies.id,
          slug: companies.slug,
          name: companies.name,
          shardId: companies.shardId,
          memberId: members.id,
        })
        .from(companyCreationRequests)
        .innerJoin(companies, eq(companies.id, companyCreationRequests.tenantId))
        .innerJoin(
          members,
          and(
            eq(members.tenantId, companyCreationRequests.tenantId),
            eq(members.userId, companyCreationRequests.userId),
          ),
        )
        .where(
          and(
            eq(companyCreationRequests.userId, userId),
            eq(companyCreationRequests.idempotencyKey, idempotencyKey),
          ),
        )
        .get(),

    create: (request: typeof companyCreationRequests.$inferInsert) =>
      db.insert(companyCreationRequests).values(request),
  }
}
