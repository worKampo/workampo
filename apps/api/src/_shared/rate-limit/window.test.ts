import { describe, expect, it } from 'vitest'
import { isOverLimit, rateLimitKey, windowEnd, windowStart } from './window'

const HOUR = 3600

describe('@id:access-96-5 code requests are counted in fixed windows', () => {
  it('a window starts at the last multiple of its length', () => {
    expect(windowStart(new Date('2026-11-22T10:59:59.999Z'), HOUR).toISOString()).toBe(
      '2026-11-22T10:00:00.000Z',
    )
  })

  it('an instant on the edge opens the next window', () => {
    expect(windowStart(new Date('2026-11-22T11:00:00.000Z'), HOUR).toISOString()).toBe(
      '2026-11-22T11:00:00.000Z',
    )
  })

  it('a window ends one length after it starts', () => {
    expect(windowEnd(new Date('2026-11-22T10:00:00.000Z'), HOUR).toISOString()).toBe(
      '2026-11-22T11:00:00.000Z',
    )
  })

  it('counts by email and by IP under separate keys', () => {
    expect(rateLimitKey('code_request', 'email', 'abc')).toBe('code_request:email:abc')
    expect(rateLimitKey('code_request', 'ip', 'abc')).toBe('code_request:ip:abc')
  })
})

describe('@id:access-96-4 code attempts have a limit', () => {
  it('counts attempts per email under their own key', () => {
    expect(rateLimitKey('code_attempt', 'email', 'abc')).toBe('code_attempt:email:abc')
  })

  it('is over the limit only once the count passes the threshold', () => {
    expect(isOverLimit(5, 5)).toBe(false)
    expect(isOverLimit(6, 5)).toBe(true)
  })
})
