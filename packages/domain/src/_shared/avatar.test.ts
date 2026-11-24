import { describe, expect, it } from 'vitest'
import { avatarColourSlot, avatarInitials } from './avatar'

describe('avatarInitials', () => {
  it('E2 a name gives the first letters of its first and last word, or two of a single word', () => {
    expect(avatarInitials('Lucía Ortega')).toBe('LO')
    expect(avatarInitials('Northwind Logistics')).toBe('NL')
    expect(avatarInitials('Sol')).toBe('SO')
  })

  it('E2 particles do not count, and accents and ñ are kept', () => {
    expect(avatarInitials('María de la Cruz')).toBe('MC')
    expect(avatarInitials('ñandú álvarez')).toBe('ÑÁ')
  })

  it('E3 a name that starts without a letter skips to the first letter; none at all is null', () => {
    expect(avatarInitials('3M España')).toBe('ME')
    expect(avatarInitials('🚀 Rocket')).toBe('RO')
    expect(avatarInitials('R2D2')).toBe('RD')
    expect(avatarInitials('123 !!')).toBeNull()
  })

  it('E4 without a name the caller passes the email, which gives its first letter', () => {
    expect(avatarInitials('ana@example.com')).toBe('A')
    expect(avatarInitials(undefined)).toBeNull()
    expect(avatarInitials('  ')).toBeNull()
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
