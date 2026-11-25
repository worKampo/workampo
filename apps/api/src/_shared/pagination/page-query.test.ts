import { describe, expect, it } from 'vitest'

// page-query.ts arrives with the API task; a non-literal path keeps typecheck green until then.
// Once it exists, import it statically.
const PAGE_QUERY: string = './page-query'
type Parsed = { success: true; data: { page: number; pageSize: number } } | { success: false }
type PageQueryModule = { pageQuerySchema: { safeParse: (query: unknown) => Parsed } }
const load = (): Promise<PageQueryModule> => import(PAGE_QUERY)

// Query values reach the route as strings (ADR-0078 rule 5.2).
describe('pageQuerySchema', () => {
  it.fails('@id:companies-91-2 defaults to page 1 of 50', async () => {
    const { pageQuerySchema } = await load()

    expect(pageQuerySchema.safeParse({})).toEqual({
      success: true,
      data: { page: 1, pageSize: 50 },
    })
  })

  it.fails('@id:companies-91-2 reads page and pageSize as integers', async () => {
    const { pageQuerySchema } = await load()

    expect(pageQuerySchema.safeParse({ page: '2', pageSize: '100' })).toEqual({
      success: true,
      data: { page: 2, pageSize: 100 },
    })
    expect(pageQuerySchema.safeParse({ page: '1', pageSize: '1' })).toMatchObject({
      data: { page: 1, pageSize: 1 },
    })
  })

  it.fails('@id:companies-91-2 caps pageSize at 100 instead of refusing it', async () => {
    const { pageQuerySchema } = await load()

    expect(pageQuerySchema.safeParse({ pageSize: '101' })).toMatchObject({
      success: true,
      data: { pageSize: 100 },
    })
    expect(pageQuerySchema.safeParse({ pageSize: '1000' })).toMatchObject({
      success: true,
      data: { pageSize: 100 },
    })
  })

  for (const query of [
    { page: '0' },
    { page: '-1' },
    { page: 'abc' },
    { page: '1.5' },
    { page: '' },
    { page: '1e3' },
    { page: ' 1' },
    { pageSize: '0' },
    { pageSize: 'abc' },
    { pageSize: '-5' },
    { pageSize: '2.5' },
  ])
    it.fails(`@id:companies-91-2 refuses ${JSON.stringify(query)}`, async () => {
      const { pageQuerySchema } = await load()

      expect(pageQuerySchema.safeParse(query).success).toBe(false)
    })

  it.fails('@id:companies-91-2 ignores fields that are not its own, such as userId', async () => {
    const { pageQuerySchema } = await load()

    expect(pageQuerySchema.safeParse({ userId: 'someone-else', page: '1' })).toEqual({
      success: true,
      data: { page: 1, pageSize: 50 },
    })
  })
})
