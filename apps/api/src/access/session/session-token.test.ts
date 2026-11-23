import { describe, expect, it } from 'vitest'
import { hashSessionToken, newSessionToken } from './session-token'

describe('session tokens', () => {
  it('@id:access-96-13 are 32 random bytes in base64url, new every time', () => {
    const tokens = Array.from({ length: 100 }, newSessionToken)
    for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(new Set(tokens).size).toBe(100)
  })

  it('are stored only as their SHA-256 in hex', async () => {
    expect(await hashSessionToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })
})
