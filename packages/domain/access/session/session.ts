export const SESSION_TTL_DAYS = 30

const DAY_MS = 24 * 60 * 60 * 1000

// Fixed from creation: no renewal on activity.
export function sessionExpiresAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + SESSION_TTL_DAYS * DAY_MS)
}

export function isSessionValid(
  session: { expiresAt: string; revokedAt: string | null },
  now: Date,
): boolean {
  return session.revokedAt === null && now.getTime() < Date.parse(session.expiresAt)
}
