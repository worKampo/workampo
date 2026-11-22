import { describe, expect, it } from 'vitest'
import { AccessError } from './errors'

describe('AccessError', () => {
  it.each([
    ['access.invalid_email', 400],
    ['access.invalid_code', 400],
    ['access.too_many_code_requests', 429],
    ['access.too_many_attempts', 429],
    ['access.email_not_verified', 403],
    ['access.contact_support', 409],
    ['access.unauthenticated', 401],
  ] as const)('%s answers %i', (code, status) => {
    const error = new AccessError(code)

    expect(error.status).toBe(status)
    expect(error.code).toBe(code)
  })
})
