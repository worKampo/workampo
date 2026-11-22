import { env, exports } from 'cloudflare:workers'
import { expect, it } from 'vitest'

// Fake identity provider: this code is valid, `000000` is expired, any other is wrong.
const VALID_CODE = '424242'
// Thresholds are environment variables (AGENTS.md "No entra"): try until the limit shows up.
const MAX_TRIES = 100

it('@id:access-96-1 requesting a code answers 202 without the code', async () => {
  const response = await post('/api/sign-in-codes', { email: newEmail() })

  expect(response.status).toBe(202)
  expect(await response.text()).toBe('')
})

it('@id:access-96-1 an invalid email answers 400 access.invalid_email', async () => {
  const response = await post('/api/sign-in-codes', { email: 'not-an-email' })

  await expectProblem(response, { status: 400, code: 'access.invalid_email' })
})

it('@id:access-96-2 the right code of an email without an account creates it and signs in', async () => {
  const email = newEmail()
  await post('/api/sign-in-codes', { email })

  const response = await post('/api/sessions', { email, code: VALID_CODE })

  expect(response.status).toBe(201)
  const { user } = await response.json<{ user: { id: string; email: string } }>()
  expect(user).toEqual({ id: expect.any(String), email })
  const token = /__Host-session=([^;]+)/.exec(response.headers.get('Set-Cookie') ?? '')?.[1]
  const me = await exports.default.fetch('https://app.test/api/me', {
    headers: { Cookie: `__Host-session=${token}` },
  })
  expect(await me.json()).toEqual(user)
  expect(await countUsers(email)).toBe(1)
})

it('@id:access-96-2 the email is stored trimmed and in lower case', async () => {
  const email = newEmail()

  const response = await post('/api/sessions', {
    email: `  ${email.toUpperCase()} `,
    code: VALID_CODE,
  })

  expect(response.status).toBe(201)
  expect(await countUsers(email)).toBe(1)
})

it('@id:access-96-2 two simultaneous sign-ins of a new email create one user', async () => {
  const email = newEmail()

  const responses = await Promise.all([
    post('/api/sessions', { email, code: VALID_CODE }),
    post('/api/sessions', { email, code: VALID_CODE }),
  ])

  expect(responses.some((r) => r.status === 201)).toBe(true)
  expect(await countUsers(email)).toBe(1)
})

it('@id:access-96-3 a wrong or expired code answers 400 access.invalid_code without a cookie', async () => {
  const email = newEmail()
  await post('/api/sign-in-codes', { email })

  for (const code of ['000000', '111111']) {
    const response = await post('/api/sessions', { email, code })

    await expectProblem(response, { status: 400, code: 'access.invalid_code' })
    expect(response.headers.has('Set-Cookie')).toBe(false)
  }
  expect(await countUsers(email)).toBe(0)
})

it('@id:access-96-3 a code with letters or without six digits answers 400', async () => {
  for (const code of ['42424a', '42424', '4242424']) {
    const response = await post('/api/sessions', { email: newEmail(), code })

    expect(response.status).toBe(400)
  }
})

it('@id:access-96-4 after too many attempts even the right code answers 429', async () => {
  const email = newEmail()
  await post('/api/sign-in-codes', { email })

  const limited = await postUntil429({
    path: '/api/sessions',
    body: () => ({ email, code: '111111' }),
  })

  await expectProblem(limited, { status: 429, code: 'access.too_many_attempts' })
  const right = await post('/api/sessions', { email, code: VALID_CODE })
  await expectProblem(right, { status: 429, code: 'access.too_many_attempts' })
  expect(await countUsers(email)).toBe(0)
})

it('@id:access-96-4 successful attempts count towards the limit too', async () => {
  const email = newEmail()

  const limited = await postUntil429({
    path: '/api/sessions',
    body: () => ({ email, code: VALID_CODE }),
  })

  await expectProblem(limited, { status: 429, code: 'access.too_many_attempts' })
})

it('@id:access-96-5 too many code requests for an email answer 429', async () => {
  const email = newEmail()

  const limited = await postUntil429({ path: '/api/sign-in-codes', body: () => ({ email }) })

  await expectProblem(limited, { status: 429, code: 'access.too_many_code_requests' })
})

it('@id:access-96-5 too many code requests from an IP answer 429', async () => {
  const ip = newIp()

  const limited = await postUntil429({
    path: '/api/sign-in-codes',
    body: () => ({ email: newEmail() }),
    ip,
  })

  await expectProblem(limited, { status: 429, code: 'access.too_many_code_requests' })
})

const newEmail = () => `new-${crypto.randomUUID()}@example.com`
const newIp = () => `2001:db8::${crypto.randomUUID().slice(0, 4)}`

function post(path: string, body: unknown) {
  return send({ path, body, ip: newIp() })
}

function send({ path, body, ip }: { path: string; body: unknown; ip: string }) {
  return exports.default.fetch(`https://app.test${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify(body),
  })
}

async function expectProblem(
  response: Response,
  { status, code }: { status: number; code: string },
) {
  expect(response.status).toBe(status)
  expect(response.headers.get('Content-Type')).toContain('application/problem+json')
  expect(await response.json()).toMatchObject({ code })
}

async function postUntil429({
  path,
  body,
  ip,
}: {
  path: string
  body: () => unknown
  ip?: string
}) {
  for (let i = 0; i < MAX_TRIES; i++) {
    const response = await send({ path, body: body(), ip: ip ?? newIp() })
    if (response.status === 429) return response
  }

  throw new Error(`no 429 from ${path} after ${MAX_TRIES} requests`)
}

const countUsers = async (email: string) =>
  (
    await env.DB_GLOBAL.prepare('SELECT COUNT(*) AS n FROM users WHERE email = ?')
      .bind(email)
      .first<{ n: number }>()
  )?.n
