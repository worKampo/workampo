import { ERROR_REFERENCE } from '@workampo/domain/_shared/api-errors'
import { afterEach, expect, it, vi } from 'vitest'
import { newErrorReference } from './error-reference'

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

function fillRandomWith(byte: number) {
  vi.spyOn(crypto, 'getRandomValues').mockImplementation((buffer) => {
    new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength).fill(byte)
    return buffer
  })
}

it('R1 a thousand references are XXXX-XXXX in Crockford base32 and none repeats', () => {
  const references: string[] = Array.from({ length: 1000 }, () => newErrorReference())

  expect(references.filter((reference) => !ERROR_REFERENCE.test(reference))).toEqual([])
  expect(new Set(references).size).toBe(1000)
})

it('R1 the same instant gives different references: no time or counter goes in', () => {
  vi.useFakeTimers({ now: new Date('2026-11-26T10:00:00Z') })

  expect(newErrorReference()).not.toBe(newErrorReference())
})

it('R1 the reference is only the 40 random bits, all zero or all one at the ends', () => {
  fillRandomWith(0x00)
  expect(newErrorReference()).toBe('0000-0000')

  fillRandomWith(0xff)
  expect(newErrorReference()).toBe('ZZZZ-ZZZZ')
})
