import type { VerifiedIdentity } from '@workampo/domain/_shared/identity'
import { sessionExpiresAt } from '@workampo/domain/access/session/session'
import { normalizeEmail } from '@workampo/domain/access/sign-in/email'
import { decideSignIn, type SignInDecision } from '@workampo/domain/access/sign-in/linking'
import { UniqueViolationError } from '../../_shared/db/unique-violation-error'
import { newId } from '../../_shared/ids/uuid'
import { identityRepo } from '../data/identity.d1.repo'
import { commitSignIn } from '../data/sign-in.d1.repo'
import { userRepo } from '../data/user.d1.repo'
import { AccessError } from '../errors'
import { hashSessionToken, newSessionToken } from '../session/session-token.logic'

type Env = { DB_GLOBAL: D1Database }
type SignIn = { identity: VerifiedIdentity; previousSessionToken?: string | undefined }
type User = { id: string; email: string }

// One use case for the code and for Google: the provider has already verified the identity.
export async function completeSignIn(env: Env, signIn: SignIn) {
  try {
    return await signInOnce(env, signIn)
  } catch (error) {
    // Two first sign-ins of one email race: the loser hits the unique index, or reads the winner's
    // user before its identity (the two reads are not one snapshot). Reading again settles both.
    if (!(error instanceof UniqueViolationError) && !isContactSupport(error)) throw error

    return signInOnce(env, signIn)
  }
}

async function signInOnce(env: Env, { identity, previousSessionToken }: SignIn) {
  const now = new Date()
  const at = now.toISOString()

  const [userBySubject, userByEmail] = await Promise.all([
    identityRepo(env).findUser(identity),
    userRepo(env).findByEmail(normalizeEmail(identity.email)),
  ])

  const decision = decideSignIn({
    identity,
    userBySubject: userBySubject ?? null,
    userByEmail: userByEmail ?? null,
  })

  if (decision.kind === 'refuse') throw new AccessError(decision.code)

  const user = userOf({ decision, now, current: userBySubject })
  const sessionToken = newSessionToken()

  // A new session on every sign-in; the one the browser brought stops working.
  await commitSignIn(env, {
    ...(decision.kind === 'create' && {
      newUser: {
        user: { ...user, at },
        identity: { provider: identity.provider, subject: identity.subject },
      },
    }),
    ...(decision.kind === 'open' && decision.newEmail && { emailChange: { ...user, at } }),
    session: {
      id: newId(now),
      userId: user.id,
      tokenHash: await hashSessionToken(sessionToken),
      createdAt: at,
      expiresAt: sessionExpiresAt(now).toISOString(),
    },
    ...(previousSessionToken && { revokeTokenHash: await hashSessionToken(previousSessionToken) }),
  })

  return { user, sessionToken }
}

function userOf({
  decision,
  now,
  current,
}: {
  decision: Exclude<SignInDecision, { kind: 'refuse' }>
  now: Date
  current: User | undefined
}): User {
  if (decision.kind === 'create') return { id: newId(now), email: decision.email }

  return { id: decision.userId, email: decision.newEmail ?? current?.email ?? '' }
}

function isContactSupport(error: unknown) {
  return error instanceof AccessError && error.code === 'access.contact_support'
}
