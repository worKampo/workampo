import { describe, expect, it } from 'vitest'
import { EMAIL_MAX_LENGTH, emailSchema, normalizeEmail } from './email'

// A 64-character local part (its own limit) and domain labels of up to 63 characters.
const emailOfLength = (length: number) =>
  `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(length - 64 - 1 - 128 - 4)}.com`

describe('@id:access-96-1 the email a code is requested for', () => {
  it('is normalised to lowercase without surrounding spaces', () => {
    expect(normalizeEmail('  Ana@Example.COM ')).toBe('ana@example.com')
    expect(emailSchema.parse('  Ana@Example.COM ')).toBe('ana@example.com')
  })

  it('accepts up to 254 characters and rejects 255', () => {
    expect(emailSchema.safeParse(emailOfLength(EMAIL_MAX_LENGTH)).success).toBe(true)
    expect(emailSchema.safeParse(emailOfLength(EMAIL_MAX_LENGTH + 1)).success).toBe(false)
  })

  it('accepts unicode in the local part', () => {
    expect(emailSchema.parse('Íñigo@example.com')).toBe('íñigo@example.com')
  })

  it('rejects what is not an email', () => {
    for (const email of ['', 'not-an-email', 'ana@', '@example.com', 'ana example@example.com'])
      expect(emailSchema.safeParse(email).success, email).toBe(false)
  })
})
