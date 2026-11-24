import { describe, expect, it } from 'vitest'
import { avatarColourSlot, avatarInitials } from './avatar'

const email = 'ana@example.com'

describe('avatarInitials', () => {
  it('E2 a name gives the first letters of its first and last word, or two of a single word', () => {
    expect(avatarInitials({ name: 'Lucía Ortega', email })).toBe('LO')
    expect(avatarInitials({ name: 'Northwind Logistics', email })).toBe('NL')
    expect(avatarInitials({ name: 'Sol', email })).toBe('SO')
  })

  it('E2 particles do not count, and accents and ñ are kept', () => {
    expect(avatarInitials({ name: 'María de la Cruz', email })).toBe('MC')
    expect(avatarInitials({ name: 'ñandú álvarez', email })).toBe('ÑÁ')
  })

  it('E3 a name that starts without a letter skips to the first letter; none at all is null', () => {
    expect(avatarInitials({ name: '3M España', email })).toBe('ME')
    expect(avatarInitials({ name: '🚀 Rocket', email })).toBe('RO')
    expect(avatarInitials({ name: '123 !!', email })).toBeNull()
  })

  it('E4 without a name, the first letter of the email', () => {
    expect(avatarInitials({ name: undefined, email })).toBe('A')
    expect(avatarInitials({ name: '  ', email })).toBe('A')
    expect(avatarInitials({ name: undefined })).toBeNull()
  })
})

describe('avatarColourSlot', () => {
  it('E5 the same initials always land on the same slot, within the palette', () => {
    const slot = avatarColourSlot({ initials: 'LO', slots: 6 })

    expect(avatarColourSlot({ initials: 'LO', slots: 6 })).toBe(slot)
    expect(slot).toBeGreaterThanOrEqual(0)
    expect(slot).toBeLessThan(6)
  })

  it('E5 different initials spread over the palette', () => {
    const slots = new Set(
      ['LO', 'NL', 'SO', 'MC', 'ÑÁ', 'ME', 'RO', 'AB', 'CD', 'EF'].map((initials) =>
        avatarColourSlot({ initials, slots: 6 }),
      ),
    )

    expect(slots.size).toBeGreaterThan(3)
  })
})
