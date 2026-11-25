import { env } from 'cloudflare:workers'
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import type { AppEnv } from '../_shared/http/app-env'
import { sessionRepo } from './_repo/session.d1.repo'
import { requireSession, type SessionVariables } from './require-session.middleware'
import { hashSessionToken, newSessionToken } from './session/session-token.logic'

const app = new Hono<AppEnv & { Variables: SessionVariables }>()
  .use(requireSession)
  .get('/me', (c) => c.json(c.var.session))

const DAY_MS = 24 * 60 * 60 * 1000

describe('requireSession', () => {
  it('lets a valid session through with its user', async () => {
    const userId = crypto.randomUUID()
    const response = await me(await sessionOf(userId))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ id: expect.any(String), userId })
  })

  it('@id:access-96-14 refuses no cookie, an unknown token and a revoked session', async () => {
    await expectUnauthenticated(await me())
    await expectUnauthenticated(await me(newSessionToken()))
    await expectUnauthenticated(await me(await sessionOf(crypto.randomUUID(), { isRevoked: true })))
  })

  it('@id:access-96-15 refuses a session created more than 30 days ago', async () => {
    const token = await sessionOf(crypto.randomUUID(), { createdAgoMs: 30 * DAY_MS + 1000 })

    await expectUnauthenticated(await me(token))
  })

  it('revoking by token ends that session only', async () => {
    const userId = crypto.randomUUID()
    const token = await sessionOf(userId)

    await sessionRepo(env).revokeByTokenHash(
      await hashSessionToken(token),
      new Date().toISOString(),
    )

    await expectUnauthenticated(await me(token))
  })
})

async function sessionOf(userId: string, { createdAgoMs = 0, isRevoked = false } = {}) {
  const token = newSessionToken()
  const createdAt = new Date(Date.now() - createdAgoMs)
  await env.DB_GLOBAL.prepare(
    "INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, '2026-01-01', '2026-01-01')",
  )
    .bind(userId, `${userId}@example.com`)
    .run()
  await sessionRepo(env).create({
    id: crypto.randomUUID(),
    userId,
    tokenHash: await hashSessionToken(token),
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + 30 * DAY_MS).toISOString(),
    revokedAt: isRevoked ? createdAt.toISOString() : null,
  })
  return token
}

const me = (token?: string) =>
  app.request('/me', token ? { headers: { Cookie: `__Host-session=${token}` } } : {}, env)

async function expectUnauthenticated(response: Response) {
  expect(response.status).toBe(401)
  expect(await response.json()).toMatchObject({ code: 'access.unauthenticated' })
}
