import { env, exports } from 'cloudflare:workers'
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { type Bindings, type ParsedEnv, parsedEnv } from '../_shared/env'
import { toProblem } from '../_shared/http/problem-json'
import { me, newEmail, sessionToken, signIn } from '../_shared/testing/api-requests'
import { requireSession, type SessionVariables } from '../access/require-session.middleware'
import { requireMember } from './require-member.middleware'

const ORIGIN = 'https://app.test'

type Company = { id: string; slug: string; name: string }
type Variables = SessionVariables & { env: ParsedEnv; company: unknown }

// The order every company route has: session, then membership, then the route.
function probeApp() {
  return new Hono<{ Bindings: Bindings; Variables: Variables }>()
    .use(parsedEnv)
    .use(requireSession)
    .use('/api/t/:slug/*', requireMember)
    .get('/api/t/:slug/probe', (c) => c.json(c.var.company))
    .onError((error) => {
      const problem = toProblem(error)
      if (!problem) throw error

      return problem
    })
}

async function probe(
  slug: string,
  {
    token,
    headers,
    query = '',
  }: { token?: string; headers?: Record<string, string>; query?: string } = {},
) {
  const app = probeApp()

  return app.request(
    `${ORIGIN}/api/t/${slug}/probe${query}`,
    { headers: { ...(token && { Cookie: `__Host-session=${token}` }), ...headers } },
    env,
  )
}

async function newSession() {
  const token = sessionToken(await signIn({ email: newEmail() }))
  const { id } = await (await me(token)).json<{ id: string }>()

  return { token, userId: id }
}

async function createCompany(token: string) {
  const slug = `northwind-${crypto.randomUUID().slice(0, 8)}`
  const response = await exports.default.fetch(`${ORIGIN}/api/companies`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `__Host-session=${token}`,
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({
      name: 'Northwind Logistics',
      slug,
      defaultLanguage: 'es',
      userName: 'Ana',
    }),
  })
  expect(response.status).toBe(201)

  return response.json<Company>()
}

const setCompanyStatus = (company: Company, status: string) =>
  env.DB_GLOBAL.prepare('UPDATE companies SET status = ? WHERE id = ?')
    .bind(status, company.id)
    .run()

const setMemberStatus = (
  company: Company,
  { userId, status }: { userId: string; status: string },
) =>
  env.DB_GLOBAL.prepare('UPDATE members SET status = ? WHERE tenant_id = ? AND user_id = ?')
    .bind(status, company.id, userId)
    .run()

// Status, body and every header: what tells one 404 from another.
async function snapshot(response: Response) {
  return { status: response.status, headers: [...response.headers], body: await response.text() }
}

describe('requireMember', () => {
  it.fails('@id:companies-90-1 lets an active member of an active company through with the company', async () => {
    const { token, userId } = await newSession()
    const company = await createCompany(token)
    const member = await env.DB_GLOBAL.prepare(
      'SELECT id FROM members WHERE tenant_id = ? AND user_id = ?',
    )
      .bind(company.id, userId)
      .first<{ id: string }>()

    const response = await probe(company.slug, { token })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      tenantId: company.id,
      slug: company.slug,
      name: 'Northwind Logistics',
      shardId: 'shard-1',
      memberId: member?.id,
    })
  })

  it.fails('@id:companies-90-1 lets a member of a trialing company through', async () => {
    const { token } = await newSession()
    const company = await createCompany(token)
    await setCompanyStatus(company, 'trialing')

    expect((await probe(company.slug, { token })).status).toBe(200)
  })

  it.fails('@id:companies-90-12 answers the same 404 for an invalid slug, a missing, inactive or foreign company and a suspended or leaving member', async () => {
    const ana = await newSession()
    const own = await createCompany(ana.token)
    const foreign = await createCompany((await newSession()).token)
    const deleting = await createCompany(ana.token)
    await setCompanyStatus(deleting, 'deleting')
    const suspended = await createCompany(ana.token)
    await setMemberStatus(suspended, { userId: ana.userId, status: 'suspended' })
    const leaving = await createCompany(ana.token)
    await setMemberStatus(leaving, { userId: ana.userId, status: 'leaving' })

    const answers = await Promise.all(
      [
        'API',
        'ab',
        '-norte',
        'norte-stg',
        'missing-company',
        foreign.slug,
        deleting.slug,
        suspended.slug,
        leaving.slug,
      ].map(async (slug) => snapshot(await probe(slug, { token: ana.token }))),
    )

    expect(answers[0]?.status).toBe(404)
    expect(JSON.parse(answers[0]?.body ?? '{}')).toMatchObject({ code: 'companies.not_found' })
    for (const answer of answers) expect(answer).toEqual(answers[0])
    expect((await probe(own.slug, { token: ana.token })).status).toBe(200)
  })

  it.fails('@id:companies-90-12 never takes the company from a header or the query', async () => {
    const ana = await newSession()
    const own = await createCompany(ana.token)
    const foreign = await createCompany((await newSession()).token)

    const response = await probe(foreign.slug, {
      token: ana.token,
      headers: {
        'X-Tenant-ID': own.id,
        'X-Tenant-Slug': own.slug,
        'X-Forwarded-Host': `${own.slug}.workampo.test`,
      },
      query: `?slug=${own.slug}&tenantId=${own.id}`,
    })

    expect(response.status).toBe(404)
  })

  it.fails('@id:companies-90-12 without a session answers 401 before looking at the company', async () => {
    const company = await createCompany((await newSession()).token)

    const answers = await Promise.all(
      [company.slug, 'missing-company', 'API'].map(async (slug) => snapshot(await probe(slug))),
    )

    expect(answers[0]?.status).toBe(401)
    expect(JSON.parse(answers[0]?.body ?? '{}')).toMatchObject({ code: 'access.unauthenticated' })
    for (const answer of answers) expect(answer).toEqual(answers[0])
  })
})
