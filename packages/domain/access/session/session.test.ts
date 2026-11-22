import { describe, expect, it } from 'vitest'
import { isSessionValid, SESSION_TTL_DAYS, sessionExpiresAt } from './session'

const createdAt = new Date('2026-01-01T00:00:00.000Z')
const expiresAt = sessionExpiresAt(createdAt).toISOString()
const at = (iso: string) => new Date(iso)

describe('@id:access-96-15 a session lasts 30 days', () => {
  it('expires 30 days after it is created, fixed', () => {
    expect(SESSION_TTL_DAYS).toBe(30)
    expect(expiresAt).toBe('2026-01-31T00:00:00.000Z')
  })

  it('is valid until the instant before it expires', () => {
    expect(isSessionValid({ expiresAt, revokedAt: null }, at('2026-01-30T23:59:59.999Z'))).toBe(
      true,
    )
  })

  it('is not valid at the instant it expires nor after', () => {
    expect(isSessionValid({ expiresAt, revokedAt: null }, at('2026-01-31T00:00:00.000Z'))).toBe(
      false,
    )
    expect(isSessionValid({ expiresAt, revokedAt: null }, at('2026-01-31T00:00:01.000Z'))).toBe(
      false,
    )
  })
})

describe('@id:access-96-14 a revoked session', () => {
  it('is not valid even before it expires', () => {
    const revokedAt = '2026-01-02T00:00:00.000Z'

    expect(isSessionValid({ expiresAt, revokedAt }, at('2026-01-03T00:00:00.000Z'))).toBe(false)
  })
})
