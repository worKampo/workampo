import { describe, expect, it } from 'vitest'
import { proposeSlug, RESERVED_SLUGS, slugProblem, slugSchema } from './slug'

const RESERVED = [
  'admin',
  'api',
  'app',
  'assets',
  'bo',
  'c',
  'docs',
  'health',
  'l',
  'legal',
  'login',
  'mail',
  'static',
  'status',
  'stg',
  'www',
  'workampo',
]

describe('proposeSlug', () => {
  it('@id:companies-90-2 proposes the slug from the name without accents', () => {
    expect(proposeSlug('Clínica Norte')).toBe('clinica-norte')
  })

  it('@id:companies-90-1 lowercases and joins words with one hyphen', () => {
    expect(proposeSlug('Northwind Logistics')).toBe('northwind-logistics')
    expect(proposeSlug('  Sol   &  Bakery!! ')).toBe('sol-bakery')
  })

  it('@id:companies-90-2 turns ñ, ü, ç and other diacritics into their base letter', () => {
    expect(proposeSlug('Peña Ñandú')).toBe('pena-nandu')
    expect(proposeSlug('Güell & Façade Øresund')).toBe('guell-facade-resund')
    // A decomposed accent (NFD in the input) gives the same slug as a composed one.
    expect(proposeSlug('Clínica')).toBe('clinica')
  })

  it('@id:companies-90-2 drops what has no letter or number to keep', () => {
    expect(proposeSlug('日本 🙂')).toBe('')
    expect(proposeSlug('')).toBe('')
    expect(proposeSlug('--Norte--')).toBe('norte')
  })

  it('@id:companies-90-5 cuts at 40 characters and never ends in a hyphen', () => {
    const slug = proposeSlug(`${'a'.repeat(39)} bcd`)

    expect(slug).toBe('a'.repeat(39))
    expect(proposeSlug('x'.repeat(60))).toHaveLength(40)
  })
})

describe('slugSchema and slugProblem', () => {
  it('@id:companies-90-2 accepts lowercase letters, numbers and single hyphens', () => {
    for (const slug of ['clinica-norte', 'sol', 'a1b', 'northwind-logistics-2']) {
      expect(slugSchema.safeParse(slug).success, slug).toBe(true)
      expect(slugProblem(slug), slug).toBeNull()
    }
  })

  it('@id:companies-90-4 refuses every reserved slug as reserved', () => {
    expect([...RESERVED_SLUGS].sort()).toEqual([...RESERVED].sort())
    for (const slug of RESERVED_SLUGS) {
      expect(slugSchema.safeParse(slug).success, slug).toBe(false)
      // "bo", "c" and "l" are also too short: either answer refuses them.
      if (slug.length >= 3) expect(slugProblem(slug), slug).toBe('reserved')
      else expect(slugProblem(slug), slug).not.toBeNull()
    }
  })

  it('@id:companies-90-5 refuses the approved invalid formats', () => {
    for (const slug of ['ab', 'mi--empresa', '-norte', 'norte-stg']) {
      expect(slugProblem(slug), slug).toBe('invalid')
      expect(slugSchema.safeParse(slug).success, slug).toBe(false)
    }
  })

  it('@id:companies-90-5 accepts 3 and 40 characters and refuses 2 and 41', () => {
    expect(slugProblem('abc')).toBeNull()
    expect(slugProblem('a'.repeat(40))).toBeNull()
    expect(slugProblem('ab')).toBe('invalid')
    expect(slugProblem('a'.repeat(41))).toBe('invalid')
  })

  it('@id:companies-90-5 refuses uppercase, accents, spaces, dots, slashes and an ending hyphen', () => {
    for (const slug of [
      'Norte',
      'clínica',
      'mi empresa',
      'sol.bakery',
      'sol/bakery',
      'norte-',
      'norte_sur',
      '',
      ' norte',
      'norte\n',
      'nor‮te',
      'ñandu',
    ])
      expect(slugProblem(slug), JSON.stringify(slug)).toBe('invalid')
  })

  it('@id:companies-90-5 refuses -stg only at the end', () => {
    expect(slugProblem('stg-norte')).toBeNull()
    expect(slugProblem('norte-stgx')).toBeNull()
    expect(slugProblem('norte-stg')).toBe('invalid')
  })

  it('@id:companies-90-5 refuses what is not a string', () => {
    for (const value of [null, undefined, 42, ['sol']])
      expect(slugSchema.safeParse(value).success, String(value)).toBe(false)
  })

  it('@id:companies-90-2 every slug it proposes from a usable name passes the schema', () => {
    for (const name of ['Clínica Norte', 'Peña Ñandú', `${'Ü'.repeat(45)}`, 'Sol Bakery 2'])
      expect(slugSchema.safeParse(proposeSlug(name)).success, name).toBe(true)
  })
})
