import { expect, it } from 'vitest'
import { FAKE_EXPIRED_CODE, FAKE_VALID_CODE } from '../../../_shared/identity/fake-identities'
import {
  countUsers,
  expectProblem,
  me,
  newEmail,
  newIp,
  postJson,
  sessionCookie,
} from '../../../_shared/testing/api-requests'

// Thresholds are environment variables (AGENTS.md "No entra"): try until the limit shows up.
const MAX_TRIES = 100

it('@id:access-96-1 requesting a code answers 202 without the code', async () => {
  const response = await postJson({ path: '/api/sign-in-codes', body: { email: newEmail() } })

  expect(response.status).toBe(202)
  expect(await response.text()).toBe('')
})

it('@id:access-96-1 an invalid email answers 400 access.invalid_email', async () => {
  const response = await postJson({ path: '/api/sign-in-codes', body: { email: 'not-an-email' } })

  await expectProblem(response, { status: 400, code: 'access.invalid_email' })
})

it('@id:access-96-2 the right code of an email without an account creates it and signs in', async () => {
  const email = newEmail()
  await postJson({ path: '/api/sign-in-codes', body: { email } })

  const response = await postJson({ path: '/api/sessions', body: { email, code: FAKE_VALID_CODE } })
  const { user } = await response.json<{ user: { id: string; email: string } }>()
  const signedIn = await me(sessionCookie(response))

  expect(response.status).toBe(201)
  expect(user).toEqual({ id: expect.any(String), email })
  expect(await signedIn.json()).toEqual(user)
  expect(await countUsers(email)).toBe(1)
})

it('@id:access-96-2 the email is stored trimmed and in lower case', async () => {
  const email = newEmail()

  const response = await postJson({
    path: '/api/sessions',
    body: { email: `  ${email.toUpperCase()} `, code: FAKE_VALID_CODE },
  })

  expect(response.status).toBe(201)
  expect(await countUsers(email)).toBe(1)
})

it('@id:access-96-2 two simultaneous sign-ins of a new email create one user', async () => {
  const email = newEmail()
  const body = { email, code: FAKE_VALID_CODE }

  const responses = await Promise.all([
    postJson({ path: '/api/sessions', body }),
    postJson({ path: '/api/sessions', body }),
  ])

  expect(responses.some((r) => r.status === 201)).toBe(true)
  expect(await countUsers(email)).toBe(1)
})

it('@id:access-96-3 a wrong or expired code answers 400 access.invalid_code without a cookie', async () => {
  const email = newEmail()
  await postJson({ path: '/api/sign-in-codes', body: { email } })

  for (const code of [FAKE_EXPIRED_CODE, '111111']) {
    const response = await postJson({ path: '/api/sessions', body: { email, code } })

    await expectProblem(response, { status: 400, code: 'access.invalid_code' })
  }

  expect(await countUsers(email)).toBe(0)
})

it('@id:access-96-3 a code with letters or without six digits answers 400', async () => {
  for (const code of ['42424a', '42424', '4242424']) {
    const response = await postJson({ path: '/api/sessions', body: { email: newEmail(), code } })

    expect(response.status).toBe(400)
  }
})

it('@id:access-96-4 too many attempts answer 429 access.too_many_attempts', async () => {
  const email = newEmail()

  const limited = await postUntil429({
    path: '/api/sessions',
    body: () => ({ email, code: '111111' }),
  })

  await expectProblem(limited, { status: 429, code: 'access.too_many_attempts' })
})

it('@id:access-96-4 past the limit even the right code answers 429 and opens nothing', async () => {
  const email = newEmail()
  await postUntil429({ path: '/api/sessions', body: () => ({ email, code: '111111' }) })

  const right = await postJson({ path: '/api/sessions', body: { email, code: FAKE_VALID_CODE } })

  await expectProblem(right, { status: 429, code: 'access.too_many_attempts' })
  expect(await countUsers(email)).toBe(0)
})

it('@id:access-96-4 successful attempts count towards the limit too', async () => {
  const email = newEmail()

  const limited = await postUntil429({
    path: '/api/sessions',
    body: () => ({ email, code: FAKE_VALID_CODE }),
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
    const response = await postJson({ path, body: body(), ...(ip && { ip }) })
    if (response.status === 429) return response
  }

  throw new Error(`no 429 from ${path} after ${MAX_TRIES} requests`)
}
