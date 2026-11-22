import type { VerifiedIdentity } from '@workampo/domain/access/identity'
import { sessionExpiresAt } from '@workampo/domain/access/session/session'
import { normalizeEmail } from '@workampo/domain/access/sign-in/email'
import { decideSignIn, type SignInDecision } from '@workampo/domain/access/sign-in/linking'
import { sessionRepo } from '../../_shared/auth/session-repo'
import { hashSessionToken, newSessionToken } from '../../_shared/auth/session-token'
import { newId } from '../../_shared/ids/uuid'
import { AccessError } from '../errors'
import { userRepo } from '../users/user-repo'
import { identityRepo } from './identity-repo'
import { commitSignIn } from './sign-in-repo'

type Env = { DB_GLOBAL: D1Database }
type SignIn = { identity: VerifiedIdentity; previousSessionToken?: string | undefined }
type User = { id: string; email: string }

// One use case for the code and for Google: the provider has already verified the identity.
export async function completeSignIn(env: Env, signIn: SignIn) {
  try {
    return await signInOnce(env, signIn)
  } catch (error) {
    // Two first sign-ins of one email race on its unique index; the retry finds the winner's user.
    if (!isUniqueViolation(error)) throw error

    return signInOnce(env, signIn)
  }
}

async function signInOnce(env: Env, { identity, previousSessionToken }: SignIn) {
  const now = new Date()

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

  await commitSignIn(env, [
    ...userWrites({ env, decision, user, identity, at: now.toISOString() }),
    ...(await sessionWrites({ env, user, sessionToken, previousSessionToken, now })),
  ])

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

// First in the batch: the session and the identity reference the user row.
function userWrites({
  env,
  decision,
  user,
  identity,
  at,
}: {
  env: Env
  decision: Exclude<SignInDecision, { kind: 'refuse' }>
  user: User
  identity: VerifiedIdentity
  at: string
}) {
  if (decision.kind === 'create')
    return [
      userRepo(env).create({ ...user, createdAt: at, updatedAt: at }),
      identityRepo(env).create({
        provider: identity.provider,
        subject: identity.subject,
        userId: user.id,
        createdAt: at,
      }),
    ]

  if (decision.newEmail) return [userRepo(env).changeEmail({ ...user, updatedAt: at })]

  return []
}

// A new session on every sign-in; the one the browser brought stops working.
async function sessionWrites({
  env,
  user,
  sessionToken,
  previousSessionToken,
  now,
}: {
  env: Env
  user: User
  sessionToken: string
  previousSessionToken: string | undefined
  now: Date
}) {
  const sessions = sessionRepo(env)
  const at = now.toISOString()
  const create = sessions.create({
    id: newId(now),
    userId: user.id,
    tokenHash: await hashSessionToken(sessionToken),
    createdAt: at,
    expiresAt: sessionExpiresAt(now).toISOString(),
    revokedAt: null,
  })

  if (!previousSessionToken) return [create]

  return [create, sessions.revokeByTokenHash(await hashSessionToken(previousSessionToken), at)]
}

function isUniqueViolation(error: unknown) {
  return (
    error instanceof Error && /UNIQUE constraint failed/.test(`${error.message} ${error.cause}`)
  )
}
