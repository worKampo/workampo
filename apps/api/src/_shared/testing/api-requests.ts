import { env, exports } from 'cloudflare:workers'
import { expect } from 'vitest'
import { FAKE_VALID_CODE } from '../identity/fake-identities'

// Requests and checks the HTTP integration tests share; they talk to the Worker as a browser would.

export function newEmail() {
  return `new-${crypto.randomUUID()}@example.com`
}

export function newIp() {
  return `2001:db8::${crypto.randomUUID().slice(0, 4)}`
}

export function postJson({
  path,
  body,
  ip = newIp(),
  sessionToken,
}: {
  path: string
  body: unknown
  ip?: string
  sessionToken?: string | undefined
}) {
  return exports.default.fetch(`https://app.test${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': ip,
      ...(sessionToken && { Cookie: `__Host-session=${sessionToken}` }),
    },
    body: JSON.stringify(body),
  })
}

// With the fake provider's valid code.
export function signIn({ email, previousToken }: { email: string; previousToken?: string }) {
  return postJson({
    path: '/api/sessions',
    body: { email, code: FAKE_VALID_CODE },
    sessionToken: previousToken,
  })
}

export function sessionCookie(response: Response) {
  return /__Host-session=([^;]+)/.exec(response.headers.get('Set-Cookie') ?? '')?.[1]
}

export function sessionToken(response: Response) {
  const token = sessionCookie(response)
  if (!token) throw new Error('no session cookie')

  return token
}

export function me(token: string | undefined) {
  return exports.default.fetch('https://app.test/api/me', {
    headers: token ? { Cookie: `__Host-session=${token}` } : {},
  })
}

// A domain error: its status, problem+json with its code, and no session opened.
export async function expectProblem(
  response: Response,
  { status, code }: { status: number; code: string },
) {
  expect(response.status).toBe(status)
  expect(response.headers.get('Content-Type')).toContain('application/problem+json')
  expect(await response.json()).toMatchObject({ code })
  expect(sessionCookie(response)).toBeUndefined()
}

export async function countUsers(email: string) {
  const row = await env.DB_GLOBAL.prepare('SELECT COUNT(*) AS n FROM users WHERE email = ?')
    .bind(email)
    .first<{ n: number }>()

  return row?.n
}
