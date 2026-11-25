import { assignments } from '@workampo/db/schema/shard.d1'
import { and, eq } from 'drizzle-orm'
import { shardClient } from '../../_shared/tenancy/shard.d1.repo'

export async function assignmentRepo(env: { DB_GLOBAL: D1Database }, shardId: string) {
  const db = await shardClient(env, shardId)

  return {
    // At most four rows: the unique index allows one per role on a unit.
    rolesOnUnit: ({
      tenantId,
      memberId,
      unitId,
    }: {
      tenantId: string
      memberId: string
      unitId: string
    }) =>
      db
        .select({ roleKey: assignments.roleKey })
        .from(assignments)
        .where(
          and(
            eq(assignments.tenantId, tenantId),
            eq(assignments.memberId, memberId),
            eq(assignments.unitId, unitId),
          ),
        )
        .all(),
  }
}
