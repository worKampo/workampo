import type { VerifiedIdentity } from '@workampo/domain/access/identity'

// Fixed contract of the fake provider: integration tests, E2E and the seed rely on it.
export const FAKE_VALID_CODE = '424242'
export const FAKE_EXPIRED_CODE = '000000'
export const FAKE_GOOGLE_CODE = 'fake-google'

// Functions, not module-level values, so stg and prod bundles drop this module with the fake.
export function fakeCodeIdentity(email: string): VerifiedIdentity {
  switch (email) {
    case 'linked@example.com':
      return fakeIdentity({ subject: 'linked', email })
    case 'unverified@example.com':
      return fakeIdentity({ subject: 'unverified', email, isEmailVerified: false })
    case 'renamed@example.com':
      return fakeIdentity({ subject: 'renamed', email: 'renamed.new@example.com' })
    case 'clash@example.com':
      return fakeIdentity({ subject: 'clash', email: 'linked@example.com' })
    default:
      // Any other email signs in as `fake|<email>`, verified.
      return fakeIdentity({ subject: email, email })
  }
}

export function fakeGoogleIdentity(): VerifiedIdentity {
  return fakeIdentity({ subject: 'google', email: 'google@example.com' })
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
