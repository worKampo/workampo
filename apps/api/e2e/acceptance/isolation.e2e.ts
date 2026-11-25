import { type APIRequestContext, expect, request, test } from '@playwright/test'
import { FAKE_VALID_CODE, newEmail } from '../../../../e2e/support/acceptance-support'

// The app's module reads this define of wrangler.jsonc when it loads; outside the bundle it is unset.
Object.assign(globalThis, { __ALLOW_FAKE_IDENTITY__: false })
const { app } = await import('../../src/index')

// Every route a company owns, from the app itself: a new one joins the suite without being listed here.
const TENANT_PREFIX = '/api/t/:slug'
const tenantRoutes = [
  ...new Map(
    app.routes
      .filter((route) => route.method !== 'ALL' && route.path.startsWith(TENANT_PREFIX))
      .map((route) => [`${route.method} ${route.path}`, route]),
  ).values(),
]

const random = () => crypto.randomUUID().slice(0, 8)

type Answer = { status: number; body: string; headers: [string, string][] }

// What a caller can compare: status, body and headers, without the ones that change per response.
async function answerOf(
  api: APIRequestContext,
  { method, path }: { method: string; path: string },
): Promise<Answer> {
  const response = await api.fetch(path, {
    method,
    ...(method !== 'GET' && method !== 'HEAD' && { data: {} }),
  })
  const headers = response
    .headersArray()
    .map(({ name, value }): [string, string] => [name.toLowerCase(), value])
    .filter(([name]) => !['date', 'cf-ray', 'x-app-version'].includes(name))
    .sort(([a], [b]) => a.localeCompare(b))

  return { status: response.status(), body: await response.text(), headers }
}

async function signedIn(email = newEmail()) {
  const api = await request.newContext({
    ...baseUrl(),
    ignoreHTTPSErrors: true,
  })
  const response = await api.post('/api/sessions', { data: { email, code: FAKE_VALID_CODE } })
  expect(response.status()).toBe(201)

  return api
}

async function createCompany(api: APIRequestContext, slug: string) {
  const response = await api.post('/api/companies', {
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    data: { name: `E2E ${slug}`, slug, defaultLanguage: 'es', userName: 'E2E' },
  })
  expect(response.status()).toBe(201)
}

const concrete = (path: string, slug: string) =>
  path.replace(':slug', slug).replace(/:[A-Za-z]+/g, '01940000-0000-7000-8000-000000000999')

test('@id:companies-90-12 the app registers routes under /api/t/:slug', () => {
  expect(tenantRoutes.length).toBeGreaterThan(0)
})

for (const route of tenantRoutes) {
  test(`@id:companies-90-12 ${route.method} ${route.path} answers another company, a missing one and an invalid slug with the same 404`, async () => {
    const member = await signedIn()
    const own = `e2e-own-${random()}`
    await createCompany(member, own)
    const stranger = await signedIn()
    const foreign = `e2e-foreign-${random()}`
    await createCompany(stranger, foreign)

    const cases = await Promise.all(
      [foreign, `e2e-missing-${random()}`, 'API', '-norte', 'ab'].map((slug) =>
        answerOf(member, { method: route.method, path: concrete(route.path, slug) }),
      ),
    )

    expect(cases[0]?.status).toBe(404)
    expect(JSON.parse(cases[0]?.body ?? '{}')).toMatchObject({ code: 'companies.not_found' })
    // The body names no slug, so every case must be byte-identical to the first.
    for (const answer of cases.slice(1)) expect(answer).toEqual(cases[0])
  })

  test(`@id:companies-90-12 ${route.method} ${route.path} never takes the company from a header or the query`, async () => {
    const member = await signedIn()
    const own = `e2e-own-${random()}`
    await createCompany(member, own)
    const stranger = await signedIn()
    const foreign = `e2e-foreign-${random()}`
    await createCompany(stranger, foreign)

    const response = await member.fetch(
      `${concrete(route.path, foreign)}?slug=${own}&tenant=${own}`,
      {
        method: route.method,
        headers: {
          'X-Tenant-ID': own,
          'X-Tenant-Slug': own,
          'X-Forwarded-Host': `${own}.workampo.test`,
        },
        ...(route.method !== 'GET' &&
          route.method !== 'HEAD' && { data: { slug: own, tenantId: own } }),
      },
    )

    expect(response.status()).toBe(404)
  })

  test(`@id:companies-90-12 ${route.method} ${route.path} answers the same 401 without a session, whatever the company`, async () => {
    const owner = await signedIn()
    const own = `e2e-own-${random()}`
    await createCompany(owner, own)
    const anonymous = await request.newContext({
      ...baseUrl(),
      ignoreHTTPSErrors: true,
    })

    const cases = await Promise.all(
      [own, `e2e-missing-${random()}`, 'API'].map((slug) =>
        answerOf(anonymous, { method: route.method, path: concrete(route.path, slug) }),
      ),
    )

    expect(cases[0]?.status).toBe(401)
    expect(JSON.parse(cases[0]?.body ?? '{}')).toMatchObject({ code: 'access.unauthenticated' })
    for (const answer of cases.slice(1)) expect(answer).toEqual(cases[0])
  })
}

// The project's baseURL, for contexts made by hand, which do not inherit it.
function baseUrl() {
  const { baseURL } = test.info().project.use
  return baseURL ? { baseURL } : {}
}
