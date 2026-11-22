import { describe, expect, it } from 'vitest'
import { newId } from './uuid'

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('newId', () => {
  it('is a UUIDv7', () => {
    expect(newId()).toMatch(UUID_V7)
  })

  it('starts with the creation time in milliseconds', () => {
    const id = newId(new Date('2026-11-22T10:00:00.000Z'))
    expect(Number.parseInt(id.replace('-', '').slice(0, 12), 16)).toBe(
      Date.parse('2026-11-22T10:00:00.000Z'),
    )
  })

  it('sorts by creation time and never repeats', () => {
    const earlier = newId(new Date('2026-11-22T10:00:00.000Z'))
    const later = newId(new Date('2026-11-22T10:00:00.001Z'))
    expect(earlier < later).toBe(true)
    expect(new Set(Array.from({ length: 1000 }, () => newId())).size).toBe(1000)
  })
})
