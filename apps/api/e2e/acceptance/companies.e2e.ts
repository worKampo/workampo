import { type APIRequestContext, expect, request, test } from '@playwright/test'
import { FAKE_VALID_CODE, newEmail } from './support'

// Relative to apps/api, where Playwright runs: the local database the suite's wrangler dev serves.
const PERSIST = '.wrangler/e2e'
const WRANGLER = 'node_modules/wrangler/bin/wrangler.js'
// Node's modules through a non-literal import: this tsconfig has the Workers types, not Node's.
const CHILD_PROCESS: string = 'node:child_process'
const PROCESS: string = 'node:process'
type ChildProcess = {
  execFileSync: (file: string, args: string[], options: { encoding: 'utf8' }) => string
}
const isStaging = Boolean(process.env.E2E_BASE_URL)
const random = () => crypto.randomUUID().slice(0, 8)

type Company = { id: string; slug: string; name: string; url: string }
type Body = { name: string; slug: string; defaultLanguage: string; userName?: string }

async function signedIn(email = newEmail()) {
  const api = await request.newContext({
    ...baseUrl(),
    ignoreHTTPSErrors: true,
  })
  const response = await api.post('/api/sessions', { data: { email, code: FAKE_VALID_CODE } })
  expect(response.status()).toBe(201)

  return api
}

const bodyFor = (slug: string, overrides: Partial<Body> = {}): Body => ({
  name: `E2E ${slug}`,
  slug,
  defaultLanguage: 'es',
  userName: 'E2E',
  ...overrides,
})

function postCompany(
  api: APIRequestContext,
  { body, key = crypto.randomUUID() }: { body: unknown; key?: string },
) {
  return api.post('/api/companies', { headers: { 'Idempotency-Key': key }, data: body })
}

async function createCompany(api: APIRequestContext, request: { body: Body; key?: string }) {
  const response = await postCompany(api, request)
  expect(response.status()).toBe(201)

  return (await response.json()) as Company
}

async function expectProblem(
  response: { status(): number; json(): Promise<unknown> },
  { status, code }: { status: number; code: string },
) {
  expect(response.status()).toBe(status)
  expect(await response.json()).toMatchObject({ code })
}

// Reads or changes the local databases behind the API, for what no endpoint shows.
async function sql<Row>(database: 'global-local' | 'shard-1-local', command: string) {
  const { execFileSync }: ChildProcess = await import(CHILD_PROCESS)
  const { execPath }: { execPath: string } = await import(PROCESS)
  const output = execFileSync(
    execPath,
    [
      WRANGLER,
      'd1',
      'execute',
      database,
      '--local',
      '--persist-to',
      PERSIST,
      '--json',
      '--command',
      command,
    ],
    { encoding: 'utf8' },
  )
  const [result] = JSON.parse(output) as { results: Row[] }[]

  return result?.results ?? []
}

test('@id:companies-90-1 creating a company makes me its owner and main contact', async () => {
  const api = await signedIn()
  const slug = `e2e-northwind-logistics-${random()}`

  const company = await createCompany(api, { body: bodyFor(slug, { name: 'Northwind Logistics' }) })

  expect(company).toMatchObject({ slug, name: 'Northwind Logistics' })
  expect(new URL(company.url).pathname).toBe(`/c/${slug}/`)
  const context = await api.get(`/api/t/${slug}/`)
  expect(context.status()).toBe(200)
  expect(await context.json()).toEqual({ name: 'Northwind Logistics', slug, role: 'owner' })
  // The main contact shows in no endpoint yet: it is read from the local database.
  if (isStaging) return
  const me = (await (await api.get('/api/me')).json()) as { id: string }
  expect(
    await sql(
      'global-local',
      `SELECT topic, user_id FROM company_contacts WHERE tenant_id = '${company.id}'`,
    ),
  ).toEqual([{ topic: 'main', user_id: me.id }])
})

test('@id:companies-90-2 a free slug is available', async () => {
  const api = await signedIn()

  const response = await api.get(`/api/companies/availability?slug=e2e-clinica-norte-${random()}`)

  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual({ available: true })
})

test('@id:companies-90-3 a slug another company has is not available and cannot be created', async () => {
  const slug = `e2e-clinica-norte-${random()}`
  await createCompany(await signedIn(), { body: bodyFor(slug) })
  const api = await signedIn()

  const check = await api.get(`/api/companies/availability?slug=${slug}`)
  const create = await postCompany(api, { body: bodyFor(slug) })

  expect(await check.json()).toEqual({ available: false })
  await expectProblem(create, { status: 409, code: 'companies.slug_taken' })
})

test('@id:companies-90-4 a reserved slug is refused by the check and by the creation', async () => {
  const api = await signedIn()

  await expectProblem(await api.get('/api/companies/availability?slug=api'), {
    status: 400,
    code: 'companies.reserved_slug',
  })
  await expectProblem(await postCompany(api, { body: bodyFor('api') }), {
    status: 400,
    code: 'companies.reserved_slug',
  })
})

for (const slug of ['ab', 'mi--empresa', '-norte', 'norte-stg']) {
  test(`@id:companies-90-5 the slug "${slug}" has an invalid format for the check and the creation`, async () => {
    const api = await signedIn()

    await expectProblem(
      await api.get(`/api/companies/availability?slug=${encodeURIComponent(slug)}`),
      {
        status: 400,
        code: 'companies.invalid_slug',
      },
    )
    await expectProblem(await postCompany(api, { body: bodyFor(slug) }), {
      status: 400,
      code: 'companies.invalid_slug',
    })
  })
}

test('@id:companies-90-7 the chosen language is the company default', async () => {
  test.skip(isStaging, 'the default language is read from the local database')
  const company = await createCompany(await signedIn(), {
    body: bodyFor(`e2e-idioma-${random()}`, { defaultLanguage: 'es' }),
  })

  expect(
    await sql(
      'shard-1-local',
      `SELECT default_language FROM company_profiles WHERE tenant_id = '${company.id}'`,
    ),
  ).toEqual([{ default_language: 'es' }])
})

test('@id:companies-90-8 an account without a name keeps the one given when creating', async () => {
  const api = await signedIn()
  expect(await (await api.get('/api/me')).json()).toMatchObject({ name: null })

  await createCompany(api, { body: bodyFor(`e2e-ana-${random()}`, { userName: 'Ana' }) })

  expect(await (await api.get('/api/me')).json()).toMatchObject({ name: 'Ana' })
})

test('@id:companies-90-8 an account without a name cannot create a company without giving one', async () => {
  const api = await signedIn()
  const { userName: _, ...withoutName } = bodyFor(`e2e-sin-nombre-${random()}`)

  await expectProblem(await postCompany(api, { body: withoutName }), {
    status: 400,
    code: 'companies.user_name_required',
  })
})

test('@id:companies-90-9 an account that has a name keeps it', async () => {
  const api = await signedIn()
  await createCompany(api, { body: bodyFor(`e2e-primera-${random()}`, { userName: 'Ana' }) })

  await createCompany(api, { body: bodyFor(`e2e-segunda-${random()}`, { userName: 'Otra' }) })

  expect(await (await api.get('/api/me')).json()).toMatchObject({ name: 'Ana' })
})

test('@id:companies-90-10 two people sending the same slug at once create only one company', async () => {
  const slug = `e2e-sol-${random()}`
  const [ana, bea] = await Promise.all([signedIn(), signedIn()])

  const answers = await Promise.all([
    postCompany(ana, { body: bodyFor(slug) }),
    postCompany(bea, { body: bodyFor(slug) }),
  ])

  expect(answers.map((a) => a.status()).sort()).toEqual([201, 409])
  const loser = answers.find((a) => a.status() === 409)
  expect(await loser?.json()).toMatchObject({ code: 'companies.slug_taken' })
  expect(await (await bea.get(`/api/companies/availability?slug=${slug}`)).json()).toEqual({
    available: false,
  })
})

test('@id:companies-90-11 sending the same request again completes a half-created company once', async () => {
  test.skip(isStaging, 'the half-created company is made in the local database')
  const api = await signedIn()
  const key = crypto.randomUUID()
  const body = bodyFor(`e2e-a-medias-${random()}`)
  const company = await createCompany(api, { body, key })
  // The shard part never landed: only the global rows stay.
  await sql(
    'shard-1-local',
    `DELETE FROM assignments WHERE tenant_id = '${company.id}'; DELETE FROM company_profiles WHERE tenant_id = '${company.id}'; DELETE FROM units WHERE tenant_id = '${company.id}'`,
  )
  expect((await api.get(`/api/t/${body.slug}/`)).status()).toBe(404)

  const again = await createCompany(api, { body, key })

  expect(again).toEqual(company)
  expect(await (await api.get(`/api/t/${body.slug}/`)).json()).toMatchObject({ role: 'owner' })
  const counts = await sql<{ n: number }>(
    'shard-1-local',
    `SELECT (SELECT COUNT(*) FROM units WHERE tenant_id = '${company.id}') + (SELECT COUNT(*) FROM assignments WHERE tenant_id = '${company.id}') + (SELECT COUNT(*) FROM company_profiles WHERE tenant_id = '${company.id}') AS n`,
  )
  expect(counts).toEqual([{ n: 3 }])
})

test('@id:companies-90-11 the same key with another body is refused and changes nothing', async () => {
  const api = await signedIn()
  const key = crypto.randomUUID()
  const body = bodyFor(`e2e-clave-${random()}`)
  await createCompany(api, { body, key })
  const other = `e2e-otra-${random()}`

  await expectProblem(await postCompany(api, { body: bodyFor(other), key }), {
    status: 422,
    code: 'companies.idempotency_mismatch',
  })
  expect(await (await api.get(`/api/companies/availability?slug=${other}`)).json()).toEqual({
    available: true,
  })
})

test('@id:companies-90-12 another company answers like one that does not exist', async () => {
  const member = await signedIn()
  await createCompany(member, { body: bodyFor(`e2e-northwind-${random()}`) })
  const foreign = `e2e-sol-bakery-${random()}`
  await createCompany(await signedIn(), { body: bodyFor(foreign) })

  const other = await member.get(`/api/t/${foreign}/`)
  const missing = await member.get(`/api/t/e2e-missing-${random()}/`)

  expect(other.status()).toBe(404)
  expect(missing.status()).toBe(404)
  expect(await other.text()).toBe(await missing.text())
})

test('@id:companies-90-12 creating a company and checking a slug need a session', async () => {
  const anonymous = await request.newContext({
    ...baseUrl(),
    ignoreHTTPSErrors: true,
  })

  await expectProblem(await postCompany(anonymous, { body: bodyFor(`e2e-anon-${random()}`) }), {
    status: 401,
    code: 'access.unauthenticated',
  })
  await expectProblem(
    await anonymous.get(`/api/companies/availability?slug=e2e-anon-${random()}`),
    {
      status: 401,
      code: 'access.unauthenticated',
    },
  )
})

test('@id:companies-90-1 a form post from another origin or without the key writes nothing', async () => {
  const api = await signedIn()
  const slug = `e2e-csrf-${random()}`

  const crossSite = await api.post('/api/companies', {
    headers: {
      'Content-Type': 'text/plain',
      Origin: 'https://evil.test',
      'Idempotency-Key': crypto.randomUUID(),
    },
    data: JSON.stringify(bodyFor(slug)),
  })
  const withoutKey = await api.post('/api/companies', { data: bodyFor(slug) })

  expect(crossSite.status()).toBe(403)
  await expectProblem(withoutKey, { status: 400, code: 'companies.invalid_request' })
  expect(await (await api.get(`/api/companies/availability?slug=${slug}`)).json()).toEqual({
    available: true,
  })
})

// The project's baseURL, for contexts made by hand, which do not inherit it.
function baseUrl() {
  const { baseURL } = test.info().project.use
  return baseURL ? { baseURL } : {}
}
