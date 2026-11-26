const CROCKFORD_BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

// 40 random bits and nothing else (no time, ids or path), so it tells nothing about the request.
export function newErrorReference(): string {
  const bits = crypto.getRandomValues(new Uint8Array(5)).reduce((sum, byte) => sum * 256 + byte, 0)
  const chars = Array.from(
    { length: 8 },
    (_, i) => CROCKFORD_BASE32[Math.floor(bits / 2 ** (35 - i * 5)) % 32],
  ).join('')

  return `${chars.slice(0, 4)}-${chars.slice(4)}`
}
