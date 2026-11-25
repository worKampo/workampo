import { companyProfiles } from '@workampo/db/schema/shard.d1'
import { shardClient } from '../../_shared/tenancy/shard.d1.repo'

export async function companyProfileRepo(env: { DB_GLOBAL: D1Database }, shardId: string) {
  const db = await shardClient(env, shardId)

  return {
    // Unawaited, for a batch(); a retried creation keeps the first profile.
    create: (profile: typeof companyProfiles.$inferInsert) =>
      db.insert(companyProfiles).values(profile).onConflictDoNothing(),
  }
}
