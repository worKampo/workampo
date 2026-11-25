import { env, exports } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { me, newEmail, sessionToken, signIn } from '../../../_shared/testing/api-requests'

const ORIGIN = 'https://app.test'
const AT = '2026-11-25T00:00:00.000Z'

type Item = { name: string; slug: string; url: string }
type CompanyStatus = 'active' | 'trialing' | 'deleting'
type MemberStatus = 'active' | 'suspended' | 'leaving'

async function newSession() {
  const token = sessionToken(await signIn({ email: newEmail() }))
  const { id } = await (await me(token)).json<{ id: string }>()

  return { token, userId: id }
}

const list = (token: string | undefined, query = '') =>
  exports.default.fetch(`${ORIGIN}/api/companies${query}`, {
    headers: token ? { Cookie: `__Host-session=${token}` } : {},
  })

async function page(token: string, query = '') {
  const response = await list(token, query)
  expect(response.status).toBe(200)

  return response.json<{ items: Item[]; total: number }>()
}

const slugs = (items: Item[]) => items.map((item) => item.slug)
const random = () => crypto.randomUUID().slice(0, 8)

// A company in the global database with this user's membership, written directly: the list reads
// only these two tables, and statuses no endpoint sets yet can be given.
async function addCompany(
  userId: string,
  {
    name,
    slug = `co-${random()}`,
    status = 'active',
    memberStatus = 'active',
  }: { name: string; slug?: string; status?: CompanyStatus; memberStatus?: MemberStatus },
) {
  const id = crypto.randomUUID()
  await env.DB_GLOBAL.batch([
    env.DB_GLOBAL.prepare(
      "INSERT INTO companies (id, slug, name, shard_id, status, created_at, updated_at, updated_by) VALUES (?, ?, ?, 'shard-1', ?, ?, ?, ?)",
    ).bind(id, slug, name, status, AT, AT, userId),
    env.DB_GLOBAL.prepare(
      'INSERT INTO members (id, tenant_id, user_id, status, created_at, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).bind(crypto.randomUUID(), id, userId, memberStatus, AT, AT, userId),
  ])

  return { id, slug }
}

describe('GET /api/companies', () => {
  it.fails('@id:companies-91-2 lists my companies by name, each with exactly name, slug and url', async () => {
    const { token, userId } = await newSession()
    const sol = await addCompany(userId, { name: 'Sol Bakery' })
    const northwind = await addCompany(userId, { name: 'Northwind' })
    const clinica = await addCompany(userId, { name: 'Clinica Norte' })

    const { items, total } = await page(token)

    expect(total).toBe(3)
    expect(slugs(items)).toEqual([clinica.slug, northwind.slug, sol.slug])
    for (const item of items) {
      expect(Object.keys(item).sort()).toEqual(['name', 'slug', 'url'])
      expect(new URL(item.url).pathname).toBe(`/c/${item.slug}/`)
    }
    expect(items[0]?.name).toBe('Clinica Norte')
  })

  it.fails('@id:companies-91-1 the url of a created company is the one its creation gave', async () => {
    const { token } = await newSession()
    const slug = `northwind-${random()}`
    const created = await exports.default.fetch(`${ORIGIN}/api/companies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `__Host-session=${token}`,
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({ name: 'Northwind', slug, defaultLanguage: 'es', userName: 'Ana' }),
    })
    expect(created.status).toBe(201)
    const company = await created.json<{ name: string; slug: string; url: string }>()

    expect(await page(token)).toEqual({
      items: [{ name: 'Northwind', slug, url: company.url }],
      total: 1,
    })
  })

  it.fails('@id:companies-91-3 with no company the list is empty', async () => {
    const { token } = await newSession()

    expect(await page(token)).toEqual({ items: [], total: 0 })
  })

  it.fails('@id:companies-91-6 leaves out suspended and leaving memberships and deleting companies, and total counts only what is listed', async () => {
    const { token, userId } = await newSession()
    const active = await addCompany(userId, { name: 'Alfa' })
    const trialing = await addCompany(userId, { name: 'Beta', status: 'trialing' })
    await addCompany(userId, { name: 'Gamma', memberStatus: 'suspended' })
    await addCompany(userId, { name: 'Delta', memberStatus: 'leaving' })
    await addCompany(userId, { name: 'Epsilon', status: 'deleting' })
    const other = await newSession()
    const foreign = await addCompany(other.userId, { name: 'Aaa Foreign' })

    const { items, total } = await page(token)

    expect(slugs(items)).toEqual([active.slug, trialing.slug])
    expect(total).toBe(2)
    expect(slugs(items)).not.toContain(foreign.slug)
  })

  it.fails('@id:companies-91-6 a suspended membership answers the same 404 as a missing company', async () => {
    const { token, userId } = await newSession()
    const suspended = await addCompany(userId, { name: 'Sol Bakery', memberStatus: 'suspended' })
    const context = (slug: string) =>
      exports.default.fetch(`${ORIGIN}/api/t/${slug}/`, {
        headers: { Cookie: `__Host-session=${token}` },
      })

    const [listed, foreign, missing] = [
      await page(token),
      await context(suspended.slug),
      await context(`missing-${random()}`),
    ]

    expect(listed.total).toBe(0)
    expect(foreign.status).toBe(404)
    expect(await foreign.text()).toBe(await missing.text())
  })

  it.fails('@id:companies-91-2 two sessions see only their own companies, and ?userId= changes nothing', async () => {
    const ana = await newSession()
    const bea = await newSession()
    const anaCompany = await addCompany(ana.userId, { name: 'Ana Co' })
    const beaCompany = await addCompany(bea.userId, { name: 'Bea Co' })

    const anaPage = await page(ana.token)
    const beaPage = await page(bea.token, `?userId=${ana.userId}`)
    const beaUserId = await page(bea.token, `?userId=${ana.userId}&page=1&pageSize=50`)

    expect(slugs(anaPage.items)).toEqual([anaCompany.slug])
    expect(slugs(beaPage.items)).toEqual([beaCompany.slug])
    expect(beaUserId).toEqual(beaPage)
  })

  it.fails('@id:companies-91-2 orders equal names by id, so pages never skip or repeat', async () => {
    const { token, userId } = await newSession()
    const twins = [
      await addCompany(userId, { name: 'Twin' }),
      await addCompany(userId, { name: 'Twin' }),
      await addCompany(userId, { name: 'Twin' }),
    ]
    const byId = [...twins].sort((a, b) => (a.id < b.id ? -1 : 1))

    const first = await page(token, '?page=1&pageSize=2')
    const second = await page(token, '?page=2&pageSize=2')

    expect([...slugs(first.items), ...slugs(second.items)]).toEqual(byId.map((twin) => twin.slug))
    expect(first.total).toBe(3)
    expect(second.total).toBe(3)
  })

  it.fails('@id:companies-91-2 caps pageSize at 100 and counts every company in total', async () => {
    const { token, userId } = await newSession()
    for (let i = 0; i < 101; i++)
      await addCompany(userId, { name: `Company ${String(i).padStart(3, '0')}` })

    const capped = await page(token, '?pageSize=1000')
    const last = await page(token, '?page=2&pageSize=100')
    const beyond = await page(token, '?page=3&pageSize=100')

    expect(capped.items).toHaveLength(100)
    expect(capped.total).toBe(101)
    expect(last.items.map((item) => item.name)).toEqual(['Company 100'])
    expect(beyond).toEqual({ items: [], total: 101 })
  })

  it.fails('@id:companies-91-2 gives unicode and markup in a name back exactly', async () => {
    const { token, userId } = await newSession()
    const name = 'Cooperativa Agrícola Ñandú <img src=x onerror=alert(1)> 日本'
    await addCompany(userId, { name })

    expect((await page(token)).items[0]?.name).toBe(name)
  })

  for (const query of ['?page=0', '?page=abc', '?page=-1', '?pageSize=0', '?pageSize=abc'])
    it.fails(`@id:companies-91-2 refuses ${query} with 400 invalid_request`, async () => {
      const { token } = await newSession()

      const response = await list(token, query)

      expect(response.status).toBe(400)
      expect(response.headers.get('Content-Type')).toContain('application/problem+json')
      expect(await response.json()).toMatchObject({ code: 'companies.invalid_request' })
    })

  it.fails('@id:companies-91-2 answers with no-store and nosniff', async () => {
    const { token } = await newSession()

    const response = await list(token)

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })

  it.fails('@id:companies-91-2 without a session answers 401', async () => {
    const response = await list(undefined)

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ code: 'access.unauthenticated' })
  })
})
