import { env } from 'cloudflare:workers'
import { expect, it } from 'vitest'
import { expectProblem, signIn } from '../../_shared/testing/api-requests'

// The emails and subjects come from the fake identity provider (_shared/auth/fake-identities.ts).

it('@id:access-96-8 a linked identity signs in to the same account with a code', async () => {
  const first = await signIn({ email: 'linked@example.com' })

  const second = await signIn({ email: 'linked@example.com' })

  expect(second.status).toBe(201)
  const { user } = await second.json<{ user: { id: string } }>()
  expect(user.id).toBe((await first.json<{ user: { id: string } }>()).user.id)
  expect(await rows('SELECT id FROM users WHERE email = ?', 'linked@example.com')).toHaveLength(1)
})

it('@id:access-96-9 an identity without a verified email answers 403', async () => {
  const response = await signIn({ email: 'unverified@example.com' })

  await expectProblem(response, { status: 403, code: 'access.email_not_verified' })
  expect(await rows('SELECT id FROM users WHERE email = ?', 'unverified@example.com')).toEqual([])
})

it('@id:access-96-10 a new identity with the email of another account answers 409 and links nothing', async () => {
  await insertLinkedUser({ email: 'taken@example.com', subject: 'fake|taken-old' })

  const response = await signIn({ email: 'taken@example.com' })

  await expectProblem(response, { status: 409, code: 'access.contact_support' })
  expect(await rows('SELECT id FROM users WHERE email = ?', 'taken@example.com')).toHaveLength(1)
  expect(
    await rows('SELECT user_id FROM identities WHERE subject = ?', 'fake|taken@example.com'),
  ).toEqual([])
})

it('@id:access-96-11 a new verified email is saved in the account on sign-in', async () => {
  await insertLinkedUser({ email: 'renamed.old@example.com', subject: 'fake|renamed' })

  const response = await signIn({ email: 'renamed@example.com' })

  expect(response.status).toBe(201)
  expect(await response.json()).toMatchObject({ user: { email: 'renamed.new@example.com' } })
  expect(await rows('SELECT id FROM users WHERE email = ?', 'renamed.old@example.com')).toEqual([])
})

it('@id:access-96-12 a new verified email of another account answers 409 and changes nothing', async () => {
  await insertLinkedUser({ email: 'linked@example.com', subject: 'fake|linked' })
  await insertLinkedUser({ email: 'clash@example.com', subject: 'fake|clash' })
  const users = 'SELECT * FROM users WHERE email IN (?, ?) ORDER BY email'
  const before = await rows(users, 'linked@example.com', 'clash@example.com')

  const response = await signIn({ email: 'clash@example.com' })

  await expectProblem(response, { status: 409, code: 'access.contact_support' })
  expect(await rows(users, 'linked@example.com', 'clash@example.com')).toEqual(before)
})

async function insertLinkedUser({ email, subject }: { email: string; subject: string }) {
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

async function rows(sql: string, ...values: string[]) {
  const { results } = await env.DB_GLOBAL.prepare(sql)
    .bind(...values)
    .all()

  return results
}
