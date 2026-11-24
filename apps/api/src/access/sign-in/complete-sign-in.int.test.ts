import { env } from 'cloudflare:workers'
import type { VerifiedIdentity } from '@workampo/domain/_shared/identity'
import { describe, expect, it } from 'vitest'
import { AccessError } from '../errors'
import { hashSessionToken } from '../session/session-token.logic'
import { completeSignIn } from './complete-sign-in.logic'

describe('completeSignIn', () => {
  it('@id:access-96-2 a new identity with a free email creates the user, links it and opens a session', async () => {
    const identity = newIdentity()

    const { user, sessionToken } = await completeSignIn(env, { identity })

    expect(user).toEqual({ id: expect.any(String), email: identity.email })
    expect(await identityUser(identity)).toBe(user.id)
    expect(await sessionOf(sessionToken)).toMatchObject({ user_id: user.id, revoked_at: null })
  })

  it('@id:access-96-8 a linked identity opens its own user again', async () => {
    const identity = newIdentity()
    const first = await completeSignIn(env, { identity })

    const second = await completeSignIn(env, { identity })

    expect(second.user).toEqual(first.user)
    expect(await countUsers(identity.email)).toBe(1)
  })

  it('@id:access-96-9 an unverified email is refused and nothing is written', async () => {
    const identity = newIdentity({ isEmailVerified: false })

    const signIn = completeSignIn(env, { identity })

    await expect(signIn).rejects.toEqual(new AccessError('access.email_not_verified'))
    expect(await countUsers(identity.email)).toBe(0)
  })

  it('@id:access-96-10 a new identity with the email of another user is refused, never linked', async () => {
    const existing = newIdentity()
    await completeSignIn(env, { identity: existing })

    const signIn = completeSignIn(env, { identity: newIdentity({ email: existing.email }) })

    await expect(signIn).rejects.toEqual(new AccessError('access.contact_support'))
    expect(await countUsers(existing.email)).toBe(1)
  })

  it('@id:access-96-11 a new verified email of a linked identity is stored', async () => {
    const identity = newIdentity()
    const { user } = await completeSignIn(env, { identity })
    const newEmail = `renamed-${crypto.randomUUID()}@example.com`

    const renamed = await completeSignIn(env, { identity: { ...identity, email: newEmail } })

    expect(renamed.user).toEqual({ id: user.id, email: newEmail })
    expect(await countUsers(identity.email)).toBe(0)
  })

  it('@id:access-96-12 a new verified email that belongs to another user changes nothing', async () => {
    const identity = newIdentity()
    const other = newIdentity()
    await completeSignIn(env, { identity })
    await completeSignIn(env, { identity: other })

    const signIn = completeSignIn(env, { identity: { ...identity, email: other.email } })

    await expect(signIn).rejects.toEqual(new AccessError('access.contact_support'))
    expect(await countUsers(identity.email)).toBe(1)
    expect(await countUsers(other.email)).toBe(1)
  })

  it('@id:access-96-13 a new sign-in revokes the session the browser had', async () => {
    const identity = newIdentity()
    const previous = await completeSignIn(env, { identity })

    const next = await completeSignIn(env, {
      identity,
      previousSessionToken: previous.sessionToken,
    })

    expect(next.sessionToken).not.toBe(previous.sessionToken)
    expect(await sessionOf(previous.sessionToken)).toMatchObject({ revoked_at: expect.any(String) })
    expect(await sessionOf(next.sessionToken)).toMatchObject({ revoked_at: null })
  })

  it('@id:access-96-2 two simultaneous first sign-ins of one email create one user', async () => {
    const identity = newIdentity()

    const results = await Promise.allSettled([
      completeSignIn(env, { identity }),
      completeSignIn(env, { identity }),
    ])

    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'fulfilled'])
    expect(await countUsers(identity.email)).toBe(1)
  })
})

function newIdentity(overrides: Partial<VerifiedIdentity> = {}): VerifiedIdentity {
  const id = crypto.randomUUID()

  return {
    provider: 'workos',
    subject: `user_${id}`,
    email: `new-${id}@example.com`,
    isEmailVerified: true,
    ...overrides,
  }
}

async function countUsers(email: string) {
  const row = await env.DB_GLOBAL.prepare('SELECT COUNT(*) AS n FROM users WHERE email = ?')
    .bind(email)
    .first<{ n: number }>()

  return row?.n
}

async function identityUser({ provider, subject }: VerifiedIdentity) {
  const row = await env.DB_GLOBAL.prepare(
    'SELECT user_id FROM identities WHERE provider = ? AND subject = ?',
  )
    .bind(provider, subject)
    .first<{ user_id: string }>()

  return row?.user_id
}

async function sessionOf(token: string) {
  return env.DB_GLOBAL.prepare('SELECT user_id, revoked_at FROM sessions WHERE token_hash = ?')
    .bind(await hashSessionToken(token))
    .first()
}
