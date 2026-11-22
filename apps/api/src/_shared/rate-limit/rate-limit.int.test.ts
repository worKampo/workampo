import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { hitRateLimit } from './rate-limit'

const HOUR = 3600
const NOW = new Date('2026-11-22T10:15:00.000Z')

describe('hitRateLimit', () => {
  it('@id:access-96-5 is over the limit once the hits in a window pass the threshold', async () => {
    const email = newEmail()

    const results = [await hit({ subject: email }), await hit({ subject: email })]
    const third = await hit({ subject: email })

    expect(results).toEqual([false, false])
    expect(third).toBe(true)
  })

  it('@id:access-96-5 a new window starts counting again', async () => {
    const email = newEmail()
    for (let i = 0; i < 3; i++) await hit({ subject: email })

    const nextWindow = await hit({ subject: email, at: new Date('2026-11-22T11:00:00.000Z') })

    expect(nextWindow).toBe(false)
  })

  it('@id:access-96-4 counts each subject apart', async () => {
    for (let i = 0; i < 3; i++) await hit({ subject: 'busy@example.com' })

    const other = await hit({ subject: newEmail() })

    expect(other).toBe(false)
  })

  it('two concurrent hits count two', async () => {
    const email = newEmail()

    const concurrent = await Promise.all([hit({ subject: email }), hit({ subject: email })])

    expect(concurrent).toEqual([false, false])
    expect(await hit({ subject: email })).toBe(true)
  })

  it('stores a hash of the subject, never the subject, with the end of its window', async () => {
    const email = newEmail()

    await hit({ subject: email, at: new Date('2030-01-01T00:30:00.000Z') })

    const { results } = await env.DB_GLOBAL.prepare(
      'SELECT key, count, expires_at FROM rate_limit_counters WHERE window_started_at = ?',
    )
      .bind('2030-01-01T00:00:00.000Z')
      .all()
    expect(results).toEqual([
      {
        key: expect.stringMatching(/^code_request:email:[0-9a-f]{64}$/),
        count: 1,
        expires_at: '2030-01-01T01:00:00.000Z',
      },
    ])
    expect(JSON.stringify(results)).not.toContain(email)
  })
})

// Storage is shared by the tests of a file: each test counts its own subject.
function newEmail() {
  return `${crypto.randomUUID()}@example.com`
}

function hit({ subject, at = NOW }: { subject: string; at?: Date }) {
  return hitRateLimit(env, {
    purpose: 'code_request',
    subjectKind: 'email',
    subject,
    threshold: 2,
    windowSeconds: HOUR,
    now: at,
  })
}
