export type RateLimitPurpose = 'code_request' | 'code_attempt' | 'company_create'
export type RateLimitSubjectKind = 'email' | 'ip' | 'user'

export function windowStart(now: Date, windowSeconds: number): Date {
  const windowMs = windowSeconds * 1000

  return new Date(Math.floor(now.getTime() / windowMs) * windowMs)
}

export function windowEnd(start: Date, windowSeconds: number): Date {
  return new Date(start.getTime() + windowSeconds * 1000)
}

export function rateLimitKey({
  purpose,
  subjectKind,
  subjectHash,
}: {
  purpose: RateLimitPurpose
  subjectKind: RateLimitSubjectKind
  subjectHash: string
}): string {
  return `${purpose}:${subjectKind}:${subjectHash}`
}

// `count` already includes the request being decided.
export function isOverLimit(count: number, threshold: number): boolean {
  return count > threshold
}
