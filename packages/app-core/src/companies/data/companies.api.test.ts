import { describe, expect, it } from 'vitest'
import { fakeApi, problem } from '../../_shared/testing/fake-api'
import { checkSlug, createCompany, getCompanyContext } from './companies.api'

const company = {
  id: '01940000-0000-7000-8000-000000000201',
  slug: 'northwind-logistics',
  name: 'Northwind Logistics',
  url: 'https://app.test/c/northwind-logistics/',
}
const input = { name: 'Northwind Logistics', slug: 'northwind-logistics', defaultLanguage: 'es' }

describe('companies api', () => {
  it('@id:companies-90-1 creates a company with a JSON body and the Idempotency-Key header', async () => {
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

  it('@id:companies-90-10 a taken slug fails with the slug_taken code', async () => {
    const { client } = fakeApi(() => problem({ status: 409, code: 'companies.slug_taken' }))

    const creating = createCompany(client, input, crypto.randomUUID())

    await expect(creating).rejects.toMatchObject({ status: 409, code: 'companies.slug_taken' })
  })

  it('@id:companies-90-2 checks a slug and gives its availability', async () => {
    const { client, sent } = fakeApi(() => Response.json({ available: true }))

    const answer = await checkSlug(client, 'clinica-norte')

    expect(answer).toEqual({ available: true })
    expect(sent[0]).toMatchObject({
      method: 'GET',
      url: 'https://app.test/api/companies/availability?slug=clinica-norte',
    })
  })

  it('@id:companies-90-3 a taken slug is not available', async () => {
    const { client } = fakeApi(() => Response.json({ available: false }))

    expect(await checkSlug(client, 'clinica-norte')).toEqual({ available: false })
  })

  it('@id:companies-90-4 a reserved slug fails with the reserved_slug code', async () => {
    const { client } = fakeApi(() => problem({ status: 400, code: 'companies.reserved_slug' }))

    await expect(checkSlug(client, 'api')).rejects.toMatchObject({
      status: 400,
      code: 'companies.reserved_slug',
    })
  })

  it('@id:companies-90-1 reads the context of a company by its slug', async () => {
    const context = { name: 'Northwind Logistics', slug: 'northwind', role: 'owner' }
    const { client, sent } = fakeApi(() => Response.json(context))

    expect(await getCompanyContext(client, 'northwind')).toEqual(context)
    expect(sent[0]).toMatchObject({ method: 'GET', url: 'https://app.test/api/t/northwind/' })
  })

  it('@id:companies-90-12 a company I cannot enter fails with status 404', async () => {
    const { client } = fakeApi(() => problem({ status: 404, code: 'companies.not_found' }))

    await expect(getCompanyContext(client, 'sol-bakery')).rejects.toMatchObject({
      status: 404,
      code: 'companies.not_found',
    })
  })
})

// listMyCompanies arrives with the app-core task; a non-literal path keeps typecheck green until
// then. Once it exists, import it with the others above.
const COMPANIES_API: string = './companies.api'
type MyCompanies = { items: { name: string; slug: string; url: string }[]; total: number }
type ListMyCompanies = (
  client: ReturnType<typeof fakeApi>['client'],
  query: { page: number; pageSize: number },
) => Promise<MyCompanies>
const loadList = async (): Promise<ListMyCompanies> => {
  const module: { listMyCompanies: ListMyCompanies } = await import(COMPANIES_API)
  return module.listMyCompanies
}

describe('my companies api', () => {
  it.fails('@id:companies-91-2 asks for one page of my companies and gives items and total', async () => {
    const answer: MyCompanies = {
      items: [{ name: 'Northwind', slug: 'northwind', url: 'https://app.test/c/northwind/' }],
      total: 1,
    }
    const { client, sent } = fakeApi(() => Response.json(answer))
    const listMyCompanies = await loadList()

    expect(await listMyCompanies(client, { page: 1, pageSize: 100 })).toEqual(answer)
    expect(sent).toHaveLength(1)
    expect(sent[0]?.method).toBe('GET')
    const url = new URL(sent[0]?.url ?? '')
    expect(url.pathname).toBe('/api/companies')
    expect(Object.fromEntries(url.searchParams)).toEqual({ page: '1', pageSize: '100' })
  })

  it.fails('@id:companies-91-2 without a session it fails with the unauthenticated code', async () => {
    const { client } = fakeApi(() => problem({ status: 401, code: 'access.unauthenticated' }))
    const listMyCompanies = await loadList()

    await expect(listMyCompanies(client, { page: 1, pageSize: 100 })).rejects.toMatchObject({
      status: 401,
      code: 'access.unauthenticated',
    })
  })
})
