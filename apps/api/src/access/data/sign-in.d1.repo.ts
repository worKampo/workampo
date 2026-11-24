import { globalDb } from '../../_shared/db/d1-global-db'
import { UniqueViolationError } from '../../_shared/db/unique-violation-error'
import { identityRepo } from './identity.d1.repo'
import { sessionRepo } from './session.d1.repo'
import { userRepo } from './user.d1.repo'

type Env = { DB_GLOBAL: D1Database }

// What one sign-in decided to write; this repo writes it all at once or nothing (ADR-0077).
export type SignInWrites = {
  newUser?: {
    user: { id: string; email: string; at: string }
    identity: { provider: 'workos'; subject: string }
  }
  emailChange?: { id: string; email: string; at: string }
  session: { id: string; userId: string; tokenHash: string; createdAt: string; expiresAt: string }
  revokeTokenHash?: string | undefined
}

export async function commitSignIn(env: Env, writes: SignInWrites) {
  const users = userRepo(env)
  const at = writes.session.createdAt
  // The user goes first: the identity and the session reference it.
  const userWrites = writes.newUser
    ? [
        users.create({
          id: writes.newUser.user.id,
          email: writes.newUser.user.email,
          createdAt: writes.newUser.user.at,
          updatedAt: writes.newUser.user.at,
        }),
        identityRepo(env).create({
          ...writes.newUser.identity,
          userId: writes.newUser.user.id,
          createdAt: writes.newUser.user.at,
        }),
      ]
    : []
  const emailWrites = writes.emailChange
    ? [
        users.changeEmail({
          id: writes.emailChange.id,
          email: writes.emailChange.email,
          updatedAt: writes.emailChange.at,
        }),
      ]
    : []
  const sessions = sessionRepo(env)
  const revoke = writes.revokeTokenHash
    ? [sessions.revokeByTokenHash(writes.revokeTokenHash, at)]
    : []

  const [first, ...rest] = [
    ...userWrites,
    ...emailWrites,
    sessions.create({ ...writes.session, revokedAt: null }),
    ...revoke,
  ]
  if (!first) throw new Error('a sign-in always writes its session')

  await globalDb(env)
    .batch([first, ...rest])
    .catch((error: unknown) => {
      // D1 names the refused index only in its message.
      if (
        error instanceof Error &&
        /UNIQUE constraint failed/.test(`${error.message} ${error.cause}`)
      )
        throw new UniqueViolationError(error.message, { cause: error })

      throw error
    })
}
