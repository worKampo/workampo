import { env, exports } from 'cloudflare:workers'
import { expect, it } from 'vitest'

// Emails and subjects of the fake identity provider (plan, "WorkOS adapter and fake").
const VALID_CODE = '424242'

it('@id:access-96-8 a linked identity signs in to the same account with a code', async () => {
  const first = await signIn('linked@example.com')
  const second = await signIn('linked@example.com')

  expect(second.status).toBe(201)
  const { user } = await second.json<{ user: { id: string } }>()
  expect(user.id).toBe((await first.json<{ user: { id: string } }>()).user.id)
  expect(await rows('SELECT id FROM users WHERE email = ?', 'linked@example.com')).toHaveLength(1)
})

it('@id:access-96-9 an identity without a verified email answers 403', async () => {
  const response = await signIn('unverified@example.com')

  await expectProblem(response, { status: 403, code: 'access.email_not_verified' })
  expect(await rows('SELECT id FROM users WHERE email = ?', 'unverified@example.com')).toEqual([])
})

it('@id:access-96-10 a new identity with the email of another account answers 409 and links nothing', async () => {
  await insertLinkedUser('taken@example.com', 'fake|taken-old')

  const response = await signIn('taken@example.com')

  await expectProblem(response, { status: 409, code: 'access.contact_support' })
  expect(await rows('SELECT id FROM users WHERE email = ?', 'taken@example.com')).toHaveLength(1)
  expect(
    await rows('SELECT user_id FROM identities WHERE subject = ?', 'fake|taken@example.com'),
  ).toEqual([])
})

it('@id:access-96-11 a new verified email is saved in the account on sign-in', async () => {
  await insertLinkedUser('renamed.old@example.com', 'fake|renamed')

  const response = await signIn('renamed@example.com')

  expect(response.status).toBe(201)
  expect(await response.json()).toMatchObject({ user: { email: 'renamed.new@example.com' } })
  expect(await rows('SELECT id FROM users WHERE email = ?', 'renamed.old@example.com')).toEqual([])
})

it('@id:access-96-12 a new verified email of another account answers 409 and changes nothing', async () => {
  await insertLinkedUser('linked@example.com', 'fake|linked')
  await insertLinkedUser('clash@example.com', 'fake|clash')
  const users = 'SELECT * FROM users WHERE email IN (?, ?) ORDER BY email'
  const before = await rows(users, 'linked@example.com', 'clash@example.com')

  const response = await signIn('clash@example.com')

  await expectProblem(response, { status: 409, code: 'access.contact_support' })
  expect(await rows(users, 'linked@example.com', 'clash@example.com')).toEqual(before)
})

function signIn(email: string) {
  return exports.default.fetch('https://app.test/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code: VALID_CODE }),
  })
}

async function expectProblem(
  response: Response,
  { status, code }: { status: number; code: string },
) {
  expect(response.status).toBe(status)
  expect(await response.json()).toMatchObject({ code })
  expect(response.headers.get('Set-Cookie') ?? '').not.toContain('__Host-session=')
}

async function insertLinkedUser(email: string, subject: string) {
  const at = new Date().toISOString()

  await env.DB_GLOBAL.batch([
    env.DB_GLOBAL.prepare(
      'INSERT OR IGNORE INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)',
    ).bind(crypto.randomUUID(), email, at, at),
    env.DB_GLOBAL.prepare(
      "INSERT OR IGNORE INTO identities (provider, subject, user_id, created_at) SELECT 'workos', ?, id, ? FROM users WHERE email = ?",
    ).bind(subject, at, email),
  ])
}

const rows = async (sql: string, ...values: string[]) =>
  (
    await env.DB_GLOBAL.prepare(sql)
      .bind(...values)
      .all()
  ).results
