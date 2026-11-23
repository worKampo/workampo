import type { VerifiedIdentity } from '../../_shared/identity'
import { normalizeEmail } from './email'

type User = { id: string; email: string }

export type SignInDecision =
  | { kind: 'open'; userId: string; newEmail?: string }
  | { kind: 'create'; email: string }
  | { kind: 'refuse'; code: 'access.email_not_verified' | 'access.contact_support' }

// A matching email never links on its own: the address may have been handed to someone else (ADR-0071).
export function decideSignIn({
  identity,
  userBySubject,
  userByEmail,
}: {
  identity: VerifiedIdentity
  userBySubject: User | null
  userByEmail: User | null
}): SignInDecision {
  if (!identity.isEmailVerified) return { kind: 'refuse', code: 'access.email_not_verified' }

  const email = normalizeEmail(identity.email)

  if (!userBySubject) {
    return userByEmail
      ? { kind: 'refuse', code: 'access.contact_support' }
      : { kind: 'create', email }
  }

  if (email === userBySubject.email) return { kind: 'open', userId: userBySubject.id }

  if (userByEmail && userByEmail.id !== userBySubject.id)
    return { kind: 'refuse', code: 'access.contact_support' }

  return { kind: 'open', userId: userBySubject.id, newEmail: email }
}
