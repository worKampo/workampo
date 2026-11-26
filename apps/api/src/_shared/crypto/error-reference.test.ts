import { afterEach, expect, it, vi } from 'vitest'

// A specifier Vite does not resolve ahead, so the file loads before T2 creates the module; turn it
// into a static import when the it.fails marks go.
const MODULE = './error-reference'
const load = () => import(/* @vite-ignore */ MODULE)

const ERROR_REFERENCE = /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/

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

it.fails('R1 a thousand references are XXXX-XXXX in Crockford base32 and none repeats', async () => {
  const { newErrorReference } = await load()

  const references: string[] = Array.from({ length: 1000 }, () => newErrorReference())

  expect(references.filter((reference) => !ERROR_REFERENCE.test(reference))).toEqual([])
  expect(new Set(references).size).toBe(1000)
})

it.fails('R1 the same instant gives different references: no time or counter goes in', async () => {
  const { newErrorReference } = await load()
  vi.useFakeTimers({ now: new Date('2026-11-26T10:00:00Z') })

  expect(newErrorReference()).not.toBe(newErrorReference())
})

it.fails('R1 the reference is only the 40 random bits, all zero or all one at the ends', async () => {
  const { newErrorReference } = await load()

  fillRandomWith(0x00)
  expect(newErrorReference()).toBe('0000-0000')

  fillRandomWith(0xff)
  expect(newErrorReference()).toBe('ZZZZ-ZZZZ')
})
