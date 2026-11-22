import type { VerifiedIdentity } from '@workampo/domain/access/identity'

// Fixed contract of the fake provider: integration tests, E2E and the seed rely on it.
export const FAKE_VALID_CODE = '424242'
export const FAKE_EXPIRED_CODE = '000000'
export const FAKE_GOOGLE_CODE = 'fake-google'

const identity = (subject: string, email: string, isEmailVerified = true): VerifiedIdentity => ({
  provider: 'workos',
  subject: `fake|${subject}`,
  email,
  isEmailVerified,
})

// Emails not listed sign in as `fake|<email>`, verified.
const FAKE_CODE_IDENTITIES: Readonly<Record<string, VerifiedIdentity>> = {
  'linked@example.com': identity('linked', 'linked@example.com'),
  'unverified@example.com': identity('unverified', 'unverified@example.com', false),
  'renamed@example.com': identity('renamed', 'renamed.new@example.com'),
  'clash@example.com': identity('clash', 'linked@example.com'),
}

export const FAKE_GOOGLE_IDENTITY = identity('google', 'google@example.com')

export function fakeCodeIdentity(email: string): VerifiedIdentity {
  return FAKE_CODE_IDENTITIES[email] ?? identity(email, email)
}
