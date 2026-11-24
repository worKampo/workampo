import { describe, expect, it } from 'vitest'
import type { ApiClient } from '../../_shared/api-client'
import { fakeApi, problem } from '../../_shared/testing/fake-api'

// companies.api.ts arrives with the app-core tasks of ticket 90; a non-literal path keeps
// typecheck green until then. Once it exists, import it statically.
const COMPANIES_API: string = './companies.api'
type CreateCompanyInput = { name: string; slug: string; defaultLanguage: string; userName?: string }
type Company = { id: string; slug: string; name: string; url: string }
type CompaniesApi = {
  createCompany: (
    client: ApiClient,
    input: CreateCompanyInput,
    idempotencyKey: string,
  ) => Promise<Company>
  checkSlug: (client: ApiClient, slug: string) => Promise<{ available: boolean }>
  getCompanyContext: (
    client: ApiClient,
    slug: string,
  ) => Promise<{ name: string; slug: string; role: string }>
}
const load = (): Promise<CompaniesApi> => import(COMPANIES_API)

const company = {
  id: '01940000-0000-7000-8000-000000000201',
  slug: 'northwind-logistics',
  name: 'Northwind Logistics',
  url: 'https://app.test/c/northwind-logistics/',
}
const input = { name: 'Northwind Logistics', slug: 'northwind-logistics', defaultLanguage: 'es' }

describe('companies api', () => {
  it.fails('@id:companies-90-1 creates a company with a JSON body and the Idempotency-Key header', async () => {
    const { createCompany } = await load()
    const { client, sent } = fakeApi(() => Response.json(company, { status: 201 }))
    const key = crypto.randomUUID()

    const created = await createCompany(client, { ...input, userName: 'Ana' }, key)

    expect(created).toEqual(company)
    expect(sent[0]).toMatchObject({
      method: 'POST',
      url: 'https://app.test/api/companies',
      body: { ...input, userName: 'Ana' },
    })
    expect(sent[0]?.headers.get('Idempotency-Key')).toBe(key)
    expect(sent[0]?.headers.get('Content-Type')).toContain('application/json')
  })

  it.fails('@id:companies-90-10 a taken slug fails with the slug_taken code', async () => {
    const { createCompany } = await load()
    const { client } = fakeApi(() => problem({ status: 409, code: 'companies.slug_taken' }))

    const creating = createCompany(client, input, crypto.randomUUID())

    await expect(creating).rejects.toMatchObject({ status: 409, code: 'companies.slug_taken' })
  })

  it.fails('@id:companies-90-2 checks a slug and gives its availability', async () => {
    const { checkSlug } = await load()
    const { client, sent } = fakeApi(() => Response.json({ available: true }))

    const answer = await checkSlug(client, 'clinica-norte')

    expect(answer).toEqual({ available: true })
    expect(sent[0]).toMatchObject({
      method: 'GET',
      url: 'https://app.test/api/company-slugs/clinica-norte',
    })
  })

  it.fails('@id:companies-90-3 a taken slug is not available', async () => {
    const { checkSlug } = await load()
    const { client } = fakeApi(() => Response.json({ available: false }))

    expect(await checkSlug(client, 'clinica-norte')).toEqual({ available: false })
  })

  it.fails('@id:companies-90-4 a reserved slug fails with the reserved_slug code', async () => {
    const { checkSlug } = await load()
    const { client } = fakeApi(() => problem({ status: 400, code: 'companies.reserved_slug' }))

    await expect(checkSlug(client, 'api')).rejects.toMatchObject({
      status: 400,
      code: 'companies.reserved_slug',
    })
  })

  it.fails('@id:companies-90-1 reads the context of a company by its slug', async () => {
    const { getCompanyContext } = await load()
    const context = { name: 'Northwind Logistics', slug: 'northwind', role: 'owner' }
    const { client, sent } = fakeApi(() => Response.json(context))

    expect(await getCompanyContext(client, 'northwind')).toEqual(context)
    expect(sent[0]).toMatchObject({ method: 'GET', url: 'https://app.test/api/t/northwind/' })
  })

  it.fails('@id:companies-90-12 a company I cannot enter fails with status 404', async () => {
    const { getCompanyContext } = await load()
    const { client } = fakeApi(() => problem({ status: 404, code: 'companies.not_found' }))

    await expect(getCompanyContext(client, 'sol-bakery')).rejects.toMatchObject({
      status: 404,
      code: 'companies.not_found',
    })
  })
})
