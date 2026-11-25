import { env, exports } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { me, newEmail, sessionToken, signIn } from '../../../_shared/testing/api-requests'

const ORIGIN = 'https://app.test'
const AT = '2026-11-24T00:00:00.000Z'

type Company = { id: string; slug: string; name: string }

async function newSession() {
  const token = sessionToken(await signIn({ email: newEmail() }))
  const { id } = await (await me(token)).json<{ id: string }>()

  return { token, userId: id }
}

async function createCompany(token: string, name = 'Northwind Logistics') {
  const slug = `northwind-${crypto.randomUUID().slice(0, 8)}`
  const response = await exports.default.fetch(`${ORIGIN}/api/companies`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `__Host-session=${token}`,
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({ name, slug, defaultLanguage: 'es', userName: 'Ana' }),
  })
  expect(response.status).toBe(201)

  return response.json<Company>()
}

const context = (token: string, slug: string) =>
  exports.default.fetch(`${ORIGIN}/api/t/${slug}/`, {
    headers: { Cookie: `__Host-session=${token}` },
  })

// Another person in the company with these roles on these units (the root when none is given).
async function addMember(company: Company, assignments: { role: string; unitId?: string }[]) {
  const person = await newSession()
  const memberId = crypto.randomUUID()
  await env.DB_GLOBAL.prepare(
    "INSERT INTO members (id, tenant_id, user_id, status, created_at, updated_at, updated_by) VALUES (?, ?, ?, 'active', ?, ?, ?)",
  )
    .bind(memberId, company.id, person.userId, AT, AT, person.userId)
    .run()
  for (const { role, unitId = company.id } of assignments)
    await env.DB_SHARD_1.prepare(
      'INSERT INTO assignments (id, tenant_id, member_id, role_key, unit_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
      .bind(crypto.randomUUID(), company.id, memberId, role, unitId, AT)
      .run()

  return person
}

async function addChildUnit(company: Company) {
  const id = crypto.randomUUID()
  await env.DB_SHARD_1.prepare(
    "INSERT INTO units (id, tenant_id, parent_id, name, kind, path, attributes, is_active, created_at, updated_at, updated_by) VALUES (?, ?, ?, 'Almacén', 'department', ?, '{}', 1, ?, ?, ?)",
  )
    .bind(id, company.id, company.id, `${company.id}/${id}/`, AT, AT, company.id)
    .run()

  return id
}

describe('GET /api/t/:slug/', () => {
  it('@id:companies-90-1 gives the owner the name, the slug and the owner role, nothing else', async () => {
    const { token } = await newSession()
    const company = await createCompany(token)

    const response = await context(token, company.slug)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      name: 'Northwind Logistics',
      slug: company.slug,
      role: 'owner',
    })
  })

  it('@id:companies-90-1 gives a long unicode name back exactly', async () => {
    const { token } = await newSession()
    const name = 'Cooperativa Agrícola Ñandú <b>Ελλάδα</b> 日本 — Sociedad Limitada Unipersonal'
    const company = await createCompany(token, name)

    expect(await (await context(token, company.slug)).json()).toMatchObject({ name })
  })

  it('@id:companies-90-1 gives the strongest role the member holds on the root', async () => {
    const { token } = await newSession()
    const company = await createCompany(token)
    const child = await addChildUnit(company)

    const viewer = await addMember(company, [{ role: 'viewer' }])
    const admin = await addMember(company, [
      { role: 'viewer' },
      { role: 'admin' },
      { role: 'member' },
    ])
    const childAdmin = await addMember(company, [
      { role: 'viewer' },
      { role: 'owner', unitId: child },
    ])

    expect(await (await context(viewer.token, company.slug)).json()).toMatchObject({
      role: 'viewer',
    })
    expect(await (await context(admin.token, company.slug)).json()).toMatchObject({ role: 'admin' })
    expect(await (await context(childAdmin.token, company.slug)).json()).toMatchObject({
      role: 'viewer',
    })
  })

  it('@id:companies-90-12 a member without an assignment on the root gets 404, never owner', async () => {
    const { token } = await newSession()
    const company = await createCompany(token)
    const child = await addChildUnit(company)
    const unassigned = await addMember(company, [])
    const onlyChild = await addMember(company, [{ role: 'owner', unitId: child }])
    await env.DB_SHARD_1.prepare('DELETE FROM assignments WHERE tenant_id = ? AND unit_id = ?')
      .bind(company.id, company.id)
      .run()

    for (const person of [{ token }, unassigned, onlyChild]) {
      const response = await context(person.token, company.slug)
      expect(response.status).toBe(404)
      expect(await response.json()).toMatchObject({ code: 'companies.not_found' })
    }
  })

  it('@id:companies-90-12 a member of another company gets the same 404 as for a missing one', async () => {
    const ana = await newSession()
    const anaCompany = await createCompany(ana.token)
    const bea = await newSession()
    await createCompany(bea.token)

    const foreign = await context(bea.token, anaCompany.slug)
    const missing = await context(bea.token, 'missing-company')

    expect(foreign.status).toBe(404)
    expect(await foreign.text()).toBe(await missing.text())
  })
})
