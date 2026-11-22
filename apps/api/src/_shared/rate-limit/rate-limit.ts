import {
  isOverLimit,
  type RateLimitPurpose,
  type RateLimitSubjectKind,
  rateLimitKey,
  windowEnd,
  windowStart,
} from '@workampo/domain/access/rate-limit'
import { rateLimitRepo } from './rate-limit-repo'

// Unsalted on purpose (ADR-0073): the same email or IP must land on the same row; rows live one window.
async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

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
    key: rateLimitKey(input.purpose, input.subjectKind, await sha256Hex(input.subject)),
    windowStartedAt: start.toISOString(),
    expiresAt: windowEnd(start, input.windowSeconds).toISOString(),
  })
  return isOverLimit(count, input.threshold)
}
