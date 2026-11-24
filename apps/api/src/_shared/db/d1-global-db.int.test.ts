import { env } from 'cloudflare:workers'
import { users } from '@workampo/db/schema/global.d1'
import { expect, it } from 'vitest'
import { globalDb } from './d1-global-db'

it('every test starts from DB_GLOBAL with the migrations applied', async () => {
  const db = globalDb(env)
  await db.insert(users).values({
    id: crypto.randomUUID(),
    email: 'ana@example.com',
    createdAt: '2026-11-22T00:00:00.000Z',
    updatedAt: '2026-11-22T00:00:00.000Z',
  })

  expect(await db.select({ email: users.email }).from(users)).toEqual([
    { email: 'ana@example.com' },
  ])
})
