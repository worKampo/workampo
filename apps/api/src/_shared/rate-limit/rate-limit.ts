import { sha256Hex } from '../crypto/sha256-hex'
import { rateLimitRepo } from './rate-limit.repo'
import {
  isOverLimit,
  type RateLimitPurpose,
  type RateLimitSubjectKind,
  rateLimitKey,
  windowEnd,
  windowStart,
} from './window'

// Counts this hit and answers whether the subject is now over its limit.
export async function hitRateLimit(
  env: { DB_GLOBAL: D1Database },
  input: {
    purpose: RateLimitPurpose
    subjectKind: RateLimitSubjectKind
    subject: string
    threshold: number
    windowSeconds: number
    now: Date
  },
): Promise<boolean> {
  const start = windowStart(input.now, input.windowSeconds)
  const count = await rateLimitRepo(env).increment({
    key: rateLimitKey({
      purpose: input.purpose,
      subjectKind: input.subjectKind,
      // Unsalted on purpose (ADR-0073): the same email or IP must land on the same row.
      subjectHash: await sha256Hex(input.subject),
    }),
    windowStartedAt: start.toISOString(),
    expiresAt: windowEnd(start, input.windowSeconds).toISOString(),
  })

  return isOverLimit(count, input.threshold)
}
