import { describe, expect, it } from 'vitest'
import { startCodeSignInSchema, verifyCodeSchema } from './sign-in-code'

describe('@id:access-96-1 a code request', () => {
  it('carries a normalised email', () => {
    expect(startCodeSignInSchema.parse({ email: ' Ana@Example.com' })).toEqual({
      email: 'ana@example.com',
    })
  })

  it('rejects an invalid email', () => {
    expect(startCodeSignInSchema.safeParse({ email: 'not-an-email' }).success).toBe(false)
  })
})

describe('@id:access-96-3 a code attempt', () => {
  it('takes six digits', () => {
    expect(verifyCodeSchema.parse({ email: 'ana@example.com', code: '000000' })).toEqual({
      email: 'ana@example.com',
      code: '000000',
    })
  })

  it('rejects letters, five or seven digits and non-ASCII digits', () => {
    for (const code of ['12345a', '12345', '1234567', '', ' 123456', '١٢٣٤٥٦'])
      expect(verifyCodeSchema.safeParse({ email: 'ana@example.com', code }).success, code).toBe(
        false,
      )
  })
})
