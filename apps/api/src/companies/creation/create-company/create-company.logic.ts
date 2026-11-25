import { sha256Hex } from '../../../_shared/crypto/sha256-hex'
import { UniqueViolationError } from '../../../_shared/db/unique-violation-error'
import { newId } from '../../../_shared/ids/uuid'
import { hitRateLimit } from '../../../_shared/rate-limit/rate-limit'
import { NEW_COMPANY_SHARD_ID } from '../../../_shared/tenancy/placement'
import {
  commitGlobalCreation,
  commitShardCreation,
  type ShardCreation,
  userHasName,
} from '../../_repo/company-creation.d1.repo'
import { companyCreationRequestRepo } from '../../_repo/company-creation-request.d1.repo'
import { CompaniesError } from '../../errors'

type Env = { DB_GLOBAL: D1Database }
type Limits = { perUser: number; perIp: number; windowSeconds: number }
type CreationRequest = {
  userId: string
  idempotencyKey: string
  ipAddress: string
  body: {
    name: string
    slug: string
    defaultLanguage: ShardCreation['defaultLanguage']
    userName?: string | undefined
  }
}
type Created = NonNullable<
  Awaited<ReturnType<ReturnType<typeof companyCreationRequestRepo>['find']>>
>

// Idempotent by (user, key): a replay or a retry gets the same company, and finishes it in the shard if needed.
export async function createCompany(
  env: Env,
  { limits, request }: { limits: Limits; request: CreationRequest },
) {
  const { body } = request
  const bodyHash = await sha256Hex(
    JSON.stringify([body.name, body.slug, body.defaultLanguage, body.userName ?? null]),
  )
  const find = () => companyCreationRequestRepo(env).find(request)

  const created = (await find()) ?? (await createInGlobal(env, { limits, request, bodyHash, find }))
  if (created.bodyHash !== bodyHash) throw new CompaniesError('companies.idempotency_mismatch')

  await commitShardCreation(env, {
    shardId: created.shardId,
    tenantId: created.tenantId,
    memberId: created.memberId,
    assignmentId: newId(),
    defaultLanguage: body.defaultLanguage,
    userId: request.userId,
    at: new Date().toISOString(),
  })

  return { id: created.tenantId, slug: created.slug, name: created.name }
}

async function createInGlobal(
  env: Env,
  {
    limits,
    request,
    bodyHash,
    find,
  }: {
    limits: Limits
    request: CreationRequest
    bodyHash: string
    find: () => Promise<Created | undefined>
  },
): Promise<Created> {
  const { userId, body } = request
  const now = new Date()
  const window = { purpose: 'company_create' as const, windowSeconds: limits.windowSeconds, now }
  const overLimit = await Promise.all([
    hitRateLimit(env, {
      ...window,
      subjectKind: 'user',
      subject: userId,
      threshold: limits.perUser,
    }),
    hitRateLimit(env, {
      ...window,
      subjectKind: 'ip',
      subject: request.ipAddress,
      threshold: limits.perIp,
    }),
  ])
  if (overLimit.some(Boolean)) throw new CompaniesError('companies.too_many_creations')

  if (!body.userName && !(await userHasName(env, userId)))
    throw new CompaniesError('companies.user_name_required')

  const company = {
    id: newId(now),
    slug: body.slug,
    name: body.name,
    shardId: NEW_COMPANY_SHARD_ID,
  }
  const memberId = newId(now)
  try {
    await commitGlobalCreation(env, {
      company,
      memberId,
      userId,
      userName: body.userName,
      idempotencyKey: request.idempotencyKey,
      bodyHash,
      at: now.toISOString(),
    })
  } catch (error) {
    if (!(error instanceof UniqueViolationError)) throw error
    // The same request sent twice at once lost the race to itself; otherwise the slug is someone else's.
    const raced = await find()
    if (!raced) throw new CompaniesError('companies.slug_taken', { cause: error })

    return raced
  }

  return {
    bodyHash,
    tenantId: company.id,
    slug: company.slug,
    name: company.name,
    shardId: company.shardId,
    memberId,
  }
}
