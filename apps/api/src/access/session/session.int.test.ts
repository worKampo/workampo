import { env, exports } from 'cloudflare:workers'
import { expect, it } from 'vitest'

const VALID_CODE = '424242'
const DAY_MS = 24 * 60 * 60 * 1000

it.fails('@id:access-96-13 the session cookie is __Host-, HttpOnly, Secure, SameSite=Lax, Path=/ and has no Domain', async () => {
  const response = await signIn(newEmail())

  const cookie = (response.headers.get('Set-Cookie') ?? '')
    .split(/,(?=\s*__Host-)/)
    .find((c) => c.trim().startsWith('__Host-session='))
  expect(cookie).toBeDefined()
  for (const attribute of [/;\s*HttpOnly/i, /;\s*Secure/i, /;\s*SameSite=Lax/i, /;\s*Path=\//i]) {
    expect(cookie).toMatch(attribute)
  }
  expect(cookie).not.toMatch(/Domain=/i)
})

it.fails('@id:access-96-13 signing in again replaces the session the browser had', async () => {
  const email = newEmail()
  const previous = sessionToken(await signIn(email))

  const current = sessionToken(await signIn(email, previous))

  expect(current).not.toBe(previous)
  await expectUnauthenticated(previous)
  expect((await me(current)).status).toBe(200)
})

it.fails('@id:access-96-14 signing out revokes the session and deletes the cookie', async () => {
  const token = sessionToken(await signIn(newEmail()))

  const response = await exports.default.fetch('https://app.test/api/sessions/current', {
    method: 'DELETE',
    headers: { Cookie: `__Host-session=${token}` },
  })

  expect(response.status).toBe(204)
  expect(response.headers.get('Set-Cookie')).toMatch(/__Host-session=.*Max-Age=0/i)
  await expectUnauthenticated(token)
})

it.fails('@id:access-96-15 the expired session of the seed answers 401', async () => {
  await insertSession('seed-expired-session', new Date('2026-01-01T00:00:00.000Z'))

  await expectUnauthenticated('seed-expired-session')
})

it.fails('@id:access-96-15 a session created 30 days and 1 second ago answers 401', async () => {
  const token = crypto.randomUUID()
  await insertSession(token, new Date(Date.now() - 30 * DAY_MS - 1000))

  await expectUnauthenticated(token)
})

it.fails('@id:access-96-15 a session created 29 days ago is still valid', async () => {
  const token = crypto.randomUUID()
  await insertSession(token, new Date(Date.now() - 29 * DAY_MS))

  expect((await me(token)).status).toBe(200)
})

function signIn(email: string, previousToken?: string) {
  return exports.default.fetch('https://app.test/api/sessions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(previousToken && { Cookie: `__Host-session=${previousToken}` }),
    },
    body: JSON.stringify({ email, code: VALID_CODE }),
  })
}

function sessionToken(response: Response) {
  const token = /__Host-session=([^;]+)/.exec(response.headers.get('Set-Cookie') ?? '')?.[1]
  if (!token) throw new Error('no session cookie')

  return token
}

const me = (token: string) =>
  exports.default.fetch('https://app.test/api/me', {
    headers: { Cookie: `__Host-session=${token}` },
  })

async function expectUnauthenticated(token: string) {
  const response = await me(token)

  expect(response.status).toBe(401)
  expect(await response.json()).toMatchObject({ code: 'access.unauthenticated' })
}

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))

  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Inserts a user with a session created at `createdAt` that lasts 30 days. */
async function insertSession(token: string, createdAt: Date) {
  const userId = crypto.randomUUID()
  const at = createdAt.toISOString()
  const expiresAt = new Date(createdAt.getTime() + 30 * DAY_MS).toISOString()

  await env.DB_GLOBAL.batch([
    env.DB_GLOBAL.prepare(
      'INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)',
    ).bind(userId, `new-${userId}@example.com`, at, at),
    env.DB_GLOBAL.prepare(
      'INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, revoked_at) VALUES (?, ?, ?, ?, ?, NULL)',
    ).bind(crypto.randomUUID(), userId, await sha256Hex(token), at, expiresAt),
  ])
}

const newEmail = () => `new-${crypto.randomUUID()}@example.com`
