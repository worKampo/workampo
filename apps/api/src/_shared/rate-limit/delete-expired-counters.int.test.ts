import { env } from 'cloudflare:workers'
import { expect, it } from 'vitest'
import { deleteExpiredCounters } from './delete-expired-counters'

it('deletes the counters whose window has ended and keeps the rest', async () => {
  await env.DB_GLOBAL.batch([
    counter({ key: 'code_request:email:ended', expiresAt: '2026-11-22T09:00:00.000Z' }),
    counter({ key: 'code_request:email:edge', expiresAt: '2026-11-22T10:00:00.000Z' }),
    counter({ key: 'code_request:email:live', expiresAt: '2026-11-22T11:00:00.000Z' }),
  ])

  await deleteExpiredCounters(env, new Date('2026-11-22T10:00:00.000Z'))

  const { results } = await env.DB_GLOBAL.prepare(
    'SELECT key FROM rate_limit_counters ORDER BY key',
  ).all()
  expect(results).toEqual([{ key: 'code_request:email:edge' }, { key: 'code_request:email:live' }])
})

function counter({ key, expiresAt }: { key: string; expiresAt: string }) {
  return env.DB_GLOBAL.prepare(
    'INSERT INTO rate_limit_counters (key, window_started_at, count, expires_at) VALUES (?, ?, 1, ?)',
  ).bind(key, '2026-11-22T08:00:00.000Z', expiresAt)
}
