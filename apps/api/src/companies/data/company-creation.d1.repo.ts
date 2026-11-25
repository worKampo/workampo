import { companies, members, users } from '@workampo/db/schema/global.d1'
import { assignments, type companyProfiles } from '@workampo/db/schema/shard.d1'
import { and, eq, isNull } from 'drizzle-orm'
import { globalDb } from '../../_shared/db/d1-global-db'
import { rethrowUniqueViolation } from '../../_shared/db/unique-violation-error'
import { shardClient } from '../../_shared/tenancy/shard.d1.repo'
import { companyContactRepo } from './company-contact.d1.repo'
import { companyCreationRequestRepo } from './company-creation-request.d1.repo'
import { companyProfileRepo } from './company-profile.d1.repo'
import { unitRepo } from './unit.d1.repo'

type Env = { DB_GLOBAL: D1Database }

// What one creation decided to write in DB_GLOBAL; written all at once or nothing (ADR-0077).
export type GlobalCreation = {
  company: { id: string; slug: string; name: string; shardId: string }
  memberId: string
  userId: string
  userName?: string | undefined
  idempotencyKey: string
  bodyHash: string
  at: string
}

export type ShardCreation = {
  shardId: string
  tenantId: string
  memberId: string
  assignmentId: string
  defaultLanguage: (typeof companyProfiles.$inferInsert)['defaultLanguage']
  userId: string
  at: string
}

// users belongs to access: this read and the write below are the one decided exception, so the name lands with the company.
export async function userHasName(env: Env, userId: string) {
  const user = await globalDb(env)
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .get()

  return !!user?.name
}

export async function commitGlobalCreation(env: Env, writes: GlobalCreation) {
  const db = globalDb(env)
  const { company, memberId, userId, at } = writes
  const audit = { createdAt: at, updatedAt: at, updatedBy: userId }

  await db
    .batch([
      db.insert(companies).values({ ...company, status: 'active', ...audit }),
      db
        .insert(members)
        .values({ id: memberId, tenantId: company.id, userId, status: 'active', ...audit }),
      companyContactRepo(env).create({
        tenantId: company.id,
        topic: 'main',
        userId,
        createdAt: at,
      }),
      companyCreationRequestRepo(env).create({
        userId,
        idempotencyKey: writes.idempotencyKey,
        bodyHash: writes.bodyHash,
        tenantId: company.id,
        createdAt: at,
      }),
      // Cross-domain write to access's users (decided exception): only a first name, never a change.
      ...(writes.userName
        ? [
            db
              .update(users)
              .set({ name: writes.userName, updatedAt: at })
              .where(and(eq(users.id, userId), isNull(users.name))),
          ]
        : []),
    ])
    .catch(rethrowUniqueViolation)
}

// Only a half-created company: the batch is atomic, so a root means all three rows, and a replay
// must not bring back rows removed since. Inserts ignore conflicts for two retries at once.
export async function commitShardCreation(env: Env, writes: ShardCreation) {
  const { shardId, tenantId, userId, at } = writes
  const db = await shardClient(env, shardId)
  const units = await unitRepo(env, shardId)
  if (await units.hasRoot(tenantId)) return

  await db.batch([
    units.createRoot({ tenantId, at, by: userId }),
    db
      .insert(assignments)
      .values({
        id: writes.assignmentId,
        tenantId,
        memberId: writes.memberId,
        roleKey: 'owner',
        unitId: tenantId,
        createdAt: at,
      })
      .onConflictDoNothing(),
    (await companyProfileRepo(env, shardId)).create({
      tenantId,
      defaultLanguage: writes.defaultLanguage,
      createdAt: at,
      updatedAt: at,
      updatedBy: userId,
    }),
  ])
}
