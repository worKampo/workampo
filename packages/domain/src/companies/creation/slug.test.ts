import { describe, expect, it } from 'vitest'
import type { z } from 'zod'

// slug.ts arrives with the domain rules task; a non-literal path keeps typecheck green until then.
// Once it exists, import it statically.
const SLUG: string = './slug'
type SlugModule = {
  slugSchema: z.ZodType<string>
  slugProblem: (slug: string) => 'invalid' | 'reserved' | null
  proposeSlug: (name: string) => string
  RESERVED_SLUGS: readonly string[]
}
const load = (): Promise<SlugModule> => import(SLUG)

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
  it.fails('@id:companies-90-2 proposes the slug from the name without accents', async () => {
    const { proposeSlug } = await load()

    expect(proposeSlug('Clínica Norte')).toBe('clinica-norte')
  })

  it.fails('@id:companies-90-1 lowercases and joins words with one hyphen', async () => {
    const { proposeSlug } = await load()

    expect(proposeSlug('Northwind Logistics')).toBe('northwind-logistics')
    expect(proposeSlug('  Sol   &  Bakery!! ')).toBe('sol-bakery')
  })

  it.fails('@id:companies-90-2 turns ñ, ü, ç and other diacritics into their base letter', async () => {
    const { proposeSlug } = await load()

    expect(proposeSlug('Peña Ñandú')).toBe('pena-nandu')
    expect(proposeSlug('Güell & Façade Øresund')).toBe('guell-facade-resund')
    // A decomposed accent (NFD in the input) gives the same slug as a composed one.
    expect(proposeSlug('Clínica')).toBe('clinica')
  })

  it.fails('@id:companies-90-2 drops what has no letter or number to keep', async () => {
    const { proposeSlug } = await load()

    expect(proposeSlug('日本 🙂')).toBe('')
    expect(proposeSlug('')).toBe('')
    expect(proposeSlug('--Norte--')).toBe('norte')
  })

  it.fails('@id:companies-90-5 cuts at 40 characters and never ends in a hyphen', async () => {
    const { proposeSlug } = await load()

    const slug = proposeSlug(`${'a'.repeat(39)} bcd`)

    expect(slug).toBe('a'.repeat(39))
    expect(proposeSlug('x'.repeat(60))).toHaveLength(40)
  })
})

describe('slugSchema and slugProblem', () => {
  it.fails('@id:companies-90-2 accepts lowercase letters, numbers and single hyphens', async () => {
    const { slugSchema, slugProblem } = await load()

    for (const slug of ['clinica-norte', 'sol', 'a1b', 'northwind-logistics-2']) {
      expect(slugSchema.safeParse(slug).success, slug).toBe(true)
      expect(slugProblem(slug), slug).toBeNull()
    }
  })

  it.fails('@id:companies-90-4 refuses every reserved slug as reserved', async () => {
    const { slugProblem, slugSchema, RESERVED_SLUGS } = await load()

    expect([...RESERVED_SLUGS].sort()).toEqual([...RESERVED].sort())
    for (const slug of RESERVED_SLUGS) {
      expect(slugSchema.safeParse(slug).success, slug).toBe(false)
      // "bo", "c" and "l" are also too short: either answer refuses them.
      if (slug.length >= 3) expect(slugProblem(slug), slug).toBe('reserved')
      else expect(slugProblem(slug), slug).not.toBeNull()
    }
  })

  it.fails('@id:companies-90-5 refuses the approved invalid formats', async () => {
    const { slugProblem, slugSchema } = await load()

    for (const slug of ['ab', 'mi--empresa', '-norte', 'norte-stg']) {
      expect(slugProblem(slug), slug).toBe('invalid')
      expect(slugSchema.safeParse(slug).success, slug).toBe(false)
    }
  })

  it.fails('@id:companies-90-5 accepts 3 and 40 characters and refuses 2 and 41', async () => {
    const { slugProblem } = await load()

    expect(slugProblem('abc')).toBeNull()
    expect(slugProblem('a'.repeat(40))).toBeNull()
    expect(slugProblem('ab')).toBe('invalid')
    expect(slugProblem('a'.repeat(41))).toBe('invalid')
  })

  it.fails('@id:companies-90-5 refuses uppercase, accents, spaces, dots, slashes and an ending hyphen', async () => {
    const { slugProblem } = await load()

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

  it.fails('@id:companies-90-5 refuses -stg only at the end', async () => {
    const { slugProblem } = await load()

    expect(slugProblem('stg-norte')).toBeNull()
    expect(slugProblem('norte-stgx')).toBeNull()
    expect(slugProblem('norte-stg')).toBe('invalid')
  })

  it.fails('@id:companies-90-5 refuses what is not a string', async () => {
    const { slugSchema } = await load()

    for (const value of [null, undefined, 42, ['sol']])
      expect(slugSchema.safeParse(value).success, String(value)).toBe(false)
  })

  it.fails('@id:companies-90-2 every slug it proposes from a usable name passes the schema', async () => {
    const { proposeSlug, slugSchema } = await load()

    for (const name of ['Clínica Norte', 'Peña Ñandú', `${'Ü'.repeat(45)}`, 'Sol Bakery 2'])
      expect(slugSchema.safeParse(proposeSlug(name)).success, name).toBe(true)
  })
})
