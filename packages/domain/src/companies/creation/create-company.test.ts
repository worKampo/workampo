import { describe, expect, it } from 'vitest'
import type { z } from 'zod'

// create-company.ts arrives with the domain rules task; a non-literal path keeps typecheck green
// until then. Once it exists, import it statically.
const CREATE_COMPANY: string = './create-company'
type CreateCompanyInput = { name: string; slug: string; defaultLanguage: string; userName?: string }
type CreateCompanyModule = {
  makeCreateCompanySchema: (languages: readonly string[]) => z.ZodType<CreateCompanyInput>
}
// The languages of @workampo/i18n, which domain cannot import (i18n depends on domain).
const LANGUAGES = ['en', 'es', 'ca'] as const

async function schema() {
  const { makeCreateCompanySchema }: CreateCompanyModule = await import(CREATE_COMPANY)

  return makeCreateCompanySchema(LANGUAGES)
}

const valid = { name: 'Northwind Logistics', slug: 'northwind-logistics', defaultLanguage: 'en' }

describe('makeCreateCompanySchema', () => {
  it.fails('@id:companies-90-1 accepts a name, a slug and a default language', async () => {
    expect((await schema()).parse(valid)).toEqual(valid)
  })

  it.fails('@id:companies-90-7 accepts each language of the product and refuses any other', async () => {
    const create = await schema()

    for (const defaultLanguage of LANGUAGES)
      expect(create.safeParse({ ...valid, defaultLanguage }).success, defaultLanguage).toBe(true)
    for (const defaultLanguage of ['fr', 'ES', 'es-ES', '', null])
      expect(create.safeParse({ ...valid, defaultLanguage }).success, String(defaultLanguage)).toBe(
        false,
      )
  })

  it.fails('@id:companies-90-1 refuses any field the client may not set', async () => {
    const create = await schema()

    for (const extra of [
      { status: 'active' },
      { shardId: 'shard-1' },
      { role: 'owner' },
      { id: '01940000-0000-7000-8000-000000000001' },
      { tenantId: '01940000-0000-7000-8000-000000000001' },
      { userId: '01940000-0000-7000-8000-000000000001' },
    ])
      expect(create.safeParse({ ...valid, ...extra }).success, Object.keys(extra)[0]).toBe(false)
  })

  it.fails('@id:companies-90-4 applies the slug rules', async () => {
    const create = await schema()

    for (const slug of ['api', 'ab', 'mi--empresa', '-norte', 'norte-stg', 'Norte'])
      expect(create.safeParse({ ...valid, slug }).success, slug).toBe(false)
  })

  it.fails('@id:companies-90-1 trims the name and stores it in NFC', async () => {
    const create = await schema()

    const parsed = create.parse({ ...valid, name: '  Clínica Norte  ' })

    expect(parsed.name).toBe('Clínica Norte')
    expect(parsed.name).toBe(parsed.name.normalize('NFC'))
  })

  it.fails('@id:companies-90-1 accepts 1 to 80 characters after trimming, unicode included', async () => {
    const create = await schema()

    for (const name of ['N', 'ñ'.repeat(80), ` ${'a'.repeat(80)} `, '日本の会社'])
      expect(create.safeParse({ ...valid, name }).success, name).toBe(true)
    for (const name of ['', '   ', 'a'.repeat(81), 'ñ'.repeat(81)])
      expect(create.safeParse({ ...valid, name }).success, `${name.length}`).toBe(false)
  })

  it.fails('@id:companies-90-1 refuses control and bidi control characters in the name', async () => {
    const create = await schema()

    for (const char of [
      '\u0000',
      '\u0007',
      '\n',
      '\t',
      '\u007F',
      '‪',
      '‫',
      '‬',
      '‭',
      '‮',
      '⁦',
      '⁧',
      '⁨',
      '⁩',
    ])
      expect(
        create.safeParse({ ...valid, name: `North${char}wind` }).success,
        char.codePointAt(0)?.toString(16),
      ).toBe(false)
  })

  it.fails('@id:companies-90-1 refuses a name that is missing or not text', async () => {
    const create = await schema()
    const { name: _, ...withoutName } = valid

    expect(create.safeParse(withoutName).success).toBe(false)
    for (const name of [null, 42, ['Northwind']])
      expect(create.safeParse({ ...valid, name }).success, String(name)).toBe(false)
  })

  it.fails("@id:companies-90-8 accepts the person's name with the same rules as the company name", async () => {
    const create = await schema()

    expect(create.parse({ ...valid, userName: '  Ana  ' }).userName).toBe('Ana')
    expect(create.parse({ ...valid, userName: 'Ángela' }).userName).toBe('Ángela')
    for (const userName of ['', '   ', 'a'.repeat(81), 'A‮na', 'A\u0000na', null])
      expect(create.safeParse({ ...valid, userName }).success, String(userName)).toBe(false)
  })

  it.fails("@id:companies-90-9 leaves the person's name out when it is not sent", async () => {
    const parsed = (await schema()).parse(valid)

    expect(parsed).not.toHaveProperty('userName')
  })
})
