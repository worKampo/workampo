import { type APIRequestContext, expect, request, test } from '@playwright/test'
import { FAKE_VALID_CODE, newEmail } from '../../../../e2e/support/acceptance-support'

// Seed (packages/db/seed): linked@example.com is in Clínica Norte, Northwind and Sol Bakery;
// renamed@example.com signs in as the user whose Sol Bakery membership is suspended.
const IN_THREE = 'linked@example.com'
const SUSPENDED_IN_SOL_BAKERY = 'renamed@example.com'

const random = () => crypto.randomUUID().slice(0, 8)

type Page = { items: { name: string; slug: string; url: string }[]; total: number }

async function signedIn(email = newEmail()) {
  const api = await request.newContext({ ...baseUrl(), ignoreHTTPSErrors: true })
  const response = await api.post('/api/sessions', { data: { email, code: FAKE_VALID_CODE } })
  expect(response.status()).toBe(201)

  return api
}

async function myCompanies(api: APIRequestContext, query = '') {
  const response = await api.get(`/api/companies${query}`)
  expect(response.status()).toBe(200)

  return (await response.json()) as Page
}

async function createCompany(api: APIRequestContext, slug: string) {
  const response = await api.post('/api/companies', {
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    data: { name: `E2E ${slug}`, slug, defaultLanguage: 'es', userName: 'E2E' },
  })
  expect(response.status()).toBe(201)
}

test('@id:companies-91-1 with only one company the list holds just it', async () => {
  const api = await signedIn()
  const slug = `e2e-northwind-${random()}`
  await createCompany(api, slug)

  const page = await myCompanies(api)

  expect(page.total).toBe(1)
  expect(page.items).toHaveLength(1)
  expect(page.items[0]).toMatchObject({ name: `E2E ${slug}`, slug })
  expect(new URL(page.items[0]?.url ?? '').pathname).toBe(`/c/${slug}/`)
})

test('@id:companies-91-2 the list has my three companies by name, each with name, slug and url only', async () => {
  const api = await signedIn(IN_THREE)

  const page = await myCompanies(api)

  expect(page.total).toBe(3)
  expect(page.items.map((item) => item.slug)).toEqual(['clinica-norte', 'northwind', 'sol-bakery'])
  expect(page.items.map((item) => item.name)).toEqual(['Clínica Norte', 'Northwind', 'Sol Bakery'])
  for (const item of page.items) {
    expect(Object.keys(item).sort()).toEqual(['name', 'slug', 'url'])
    expect(new URL(item.url).pathname).toBe(`/c/${item.slug}/`)
  }
})

test('@id:companies-91-3 without any company the list is empty', async () => {
  const api = await signedIn()

  expect(await myCompanies(api)).toEqual({ items: [], total: 0 })
})

test('@id:companies-91-6 a suspended membership is not listed and its company answers 404', async () => {
  const api = await signedIn(SUSPENDED_IN_SOL_BAKERY)

  const page = await myCompanies(api)
  const company = await api.get('/api/t/sol-bakery/')

  expect(page.items.map((item) => item.slug)).toEqual(['cooperativa-agricola-nandu'])
  expect(page.total).toBe(1)
  expect(company.status()).toBe(404)
  expect(await company.json()).toMatchObject({ code: 'companies.not_found' })
})

test('@id:companies-91-2 the list comes from the session alone: two people, and ?userId= ignored', async () => {
  const ana = await signedIn()
  const anaSlug = `e2e-ana-${random()}`
  await createCompany(ana, anaSlug)
  const bea = await signedIn()
  const beaSlug = `e2e-bea-${random()}`
  await createCompany(bea, beaSlug)
  const anaId = ((await (await ana.get('/api/me')).json()) as { id: string }).id

  const anaPage = await myCompanies(ana)
  const beaPage = await myCompanies(bea, `?userId=${anaId}`)

  expect(anaPage.items.map((item) => item.slug)).toEqual([anaSlug])
  expect(beaPage.items.map((item) => item.slug)).toEqual([beaSlug])
  expect(beaPage.total).toBe(1)
})

test('@id:companies-91-2 the list needs a session and is never cached', async () => {
  const anonymous = await request.newContext({ ...baseUrl(), ignoreHTTPSErrors: true })
  const api = await signedIn(IN_THREE)

  const refused = await anonymous.get('/api/companies')
  const listed = await api.get('/api/companies')

  expect(refused.status()).toBe(401)
  expect(await refused.json()).toMatchObject({ code: 'access.unauthenticated' })
  expect(listed.headers()['cache-control']).toBe('no-store')
  expect(listed.headers()['x-content-type-options']).toBe('nosniff')
})

test('@id:companies-91-2 pages with page and pageSize; a pageSize over 100 is capped and a bad page refused', async () => {
  const api = await signedIn(IN_THREE)

  const first = await myCompanies(api, '?page=1&pageSize=2')
  const second = await myCompanies(api, '?page=2&pageSize=2')
  const capped = await myCompanies(api, '?pageSize=1000')
  const refused = await Promise.all(
    ['?page=0', '?page=abc', '?pageSize=0'].map((query) => api.get(`/api/companies${query}`)),
  )

  expect(first).toMatchObject({ total: 3 })
  expect(first.items.map((item) => item.slug)).toEqual(['clinica-norte', 'northwind'])
  expect(second.items.map((item) => item.slug)).toEqual(['sol-bakery'])
  expect(capped.items).toHaveLength(3)
  for (const answer of refused) {
    expect(answer.status()).toBe(400)
    expect(await answer.json()).toMatchObject({ code: 'companies.invalid_request' })
  }
})

// The project's baseURL, for contexts made by hand, which do not inherit it.
function baseUrl() {
  const { baseURL } = test.info().project.use
  return baseURL ? { baseURL } : {}
}
