import { units } from '@workampo/db/schema/shard.d1'
import { and, eq, isNull } from 'drizzle-orm'
import { shardClient } from '../../_shared/tenancy/shard.d1.repo'

export async function unitRepo(env: { DB_GLOBAL: D1Database }, shardId: string) {
  const db = await shardClient(env, shardId)

  return {
    hasRoot: async (tenantId: string) =>
      !!(await db
        .select({ id: units.id })
        .from(units)
        .where(and(eq(units.id, tenantId), isNull(units.parentId)))
        .get()),

    // Unawaited, for a batch(). Keyed by the company id, so a retried creation writes nothing twice.
    createRoot: ({ tenantId, at, by }: { tenantId: string; at: string; by: string }) =>
      db
        .insert(units)
        .values({
          id: tenantId,
          tenantId,
          parentId: null,
          name: null,
          kind: 'company',
          path: `${tenantId}/`,
          isActive: true,
          createdAt: at,
          updatedAt: at,
          updatedBy: by,
        })
        .onConflictDoNothing(),
  }
}
