import type { VerifiedIdentity } from '@workampo/domain/access/identity'

// Fixed contract of the fake provider: integration tests, E2E and the seed rely on it.
export const FAKE_VALID_CODE = '424242'
export const FAKE_EXPIRED_CODE = '000000'
export const FAKE_GOOGLE_CODE = 'fake-google'

// Emails not listed sign in as `fake|<email>`, verified.
const FAKE_CODE_IDENTITIES: Readonly<Record<string, VerifiedIdentity>> = {
  'linked@example.com': fakeIdentity({ subject: 'linked', email: 'linked@example.com' }),
  'unverified@example.com': fakeIdentity({
    subject: 'unverified',
    email: 'unverified@example.com',
    isEmailVerified: false,
  }),
  'renamed@example.com': fakeIdentity({ subject: 'renamed', email: 'renamed.new@example.com' }),
  'clash@example.com': fakeIdentity({ subject: 'clash', email: 'linked@example.com' }),
}

export const FAKE_GOOGLE_IDENTITY = fakeIdentity({ subject: 'google', email: 'google@example.com' })

export function fakeCodeIdentity(email: string): VerifiedIdentity {
  return FAKE_CODE_IDENTITIES[email] ?? fakeIdentity({ subject: email, email })
}

function fakeIdentity({
  subject,
  email,
  isEmailVerified = true,
}: {
  subject: string
  email: string
  isEmailVerified?: boolean
}): VerifiedIdentity {
  return { provider: 'workos', subject: `fake|${subject}`, email, isEmailVerified }
}
