import { env, exports } from 'cloudflare:workers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { me, newEmail, newIp, sessionToken, signIn } from '../../../_shared/testing/api-requests'
import { app } from '../../../index'

const ORIGIN = 'https://app.test'
const valid = { name: 'Northwind Logistics', defaultLanguage: 'es', userName: 'Ana' }
// Names the company-create thresholds take in env.ts (config task of ticket 90).
const USER_LIMIT = 'RATE_LIMIT_COMPANY_CREATES_PER_USER'
const IP_LIMIT = 'RATE_LIMIT_COMPANY_CREATES_PER_IP'

type Company = { id: string; slug: string; name: string; url: string }

afterEach(() => {
  vi.restoreAllMocks()
})

const newSlug = (prefix = 'northwind') => `${prefix}-${crypto.randomUUID().slice(0, 8)}`

async function newSession() {
  const token = sessionToken(await signIn({ email: newEmail() }))
  const { id } = await (await me(token)).json<{ id: string }>()

  return { token, userId: id }
}

// A string body is sent as is; a null key sends no Idempotency-Key; bindings go through app.request.
function post(
  token: string | undefined,
  {
    body,
    key = crypto.randomUUID(),
    ip = newIp(),
    headers = {},
    bindings,
  }: {
    body: unknown
    key?: string | null
    ip?: string
    headers?: Record<string, string>
    bindings?: typeof env
  },
) {
  const init = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': ip,
      ...(token && { Cookie: `__Host-session=${token}` }),
      ...(key !== null && { 'Idempotency-Key': key }),
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }

  return bindings
    ? app.request(`${ORIGIN}/api/companies`, init, bindings)
    : exports.default.fetch(`${ORIGIN}/api/companies`, init)
}

async function expectProblem(
  response: Response,
  { status, code }: { status: number; code: string },
) {
  expect(response.status).toBe(status)
  expect(response.headers.get('Content-Type')).toContain('application/problem+json')
  expect(await response.json()).toMatchObject({ code })
}

// Rows of `table` whose `column` is `value`, in the database that holds the table.
async function count(table: string, [column, value]: [string, unknown]) {
  const db = ['units', 'assignments', 'company_profiles'].includes(table)
    ? env.DB_SHARD_1
    : env.DB_GLOBAL
  const row = await db
    .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column} = ?`)
    .bind(value)
    .first<{ n: number }>()

  return row?.n
}

const companiesWithSlug = (slug: string) => count('companies', ['slug', slug])
const companiesOf = (userId: string) => count('members', ['user_id', userId])

async function shardRows(tenantId: string) {
  return {
    units: await count('units', ['tenant_id', tenantId]),
    assignments: await count('assignments', ['tenant_id', tenantId]),
    profiles: await count('company_profiles', ['tenant_id', tenantId]),
  }
}

function context(token: string, slug: string) {
  return exports.default.fetch(`${ORIGIN}/api/t/${slug}/`, {
    headers: { Cookie: `__Host-session=${token}` },
  })
}

describe('POST /api/companies', () => {
  it.fails('@id:companies-90-1 creates an active company on shard-1 with me as active member and main contact', async () => {
    const { token, userId } = await newSession()
    const slug = newSlug()

    const response = await post(token, { body: { ...valid, slug } })

    expect(response.status).toBe(201)
    const company = await response.json<Company>()
    expect(company).toEqual({
      id: expect.any(String),
      slug,
      name: valid.name,
      url: expect.any(String),
    })
    expect(new URL(company.url).pathname).toBe(`/c/${slug}/`)
    expect(
      await env.DB_GLOBAL.prepare('SELECT slug, name, shard_id, status FROM companies WHERE id = ?')
        .bind(company.id)
        .first(),
    ).toEqual({ slug, name: valid.name, shard_id: 'shard-1', status: 'active' })
    expect(
      await env.DB_GLOBAL.prepare('SELECT user_id, status FROM members WHERE tenant_id = ?')
        .bind(company.id)
        .all(),
    ).toMatchObject({ results: [{ user_id: userId, status: 'active' }] })
    expect(
      await env.DB_GLOBAL.prepare('SELECT topic, user_id FROM company_contacts WHERE tenant_id = ?')
        .bind(company.id)
        .all(),
    ).toMatchObject({ results: [{ topic: 'main', user_id: userId }] })
  })

  it.fails('@id:companies-90-1 writes the root unit, keyed by the company id, and my owner assignment on it', async () => {
    const { token } = await newSession()
    const slug = newSlug()

    const company = await (await post(token, { body: { ...valid, slug } })).json<Company>()

    expect(
      await env.DB_SHARD_1.prepare(
        'SELECT id, parent_id, name, kind, path, is_active FROM units WHERE tenant_id = ?',
      )
        .bind(company.id)
        .all(),
    ).toMatchObject({
      results: [
        {
          id: company.id,
          parent_id: null,
          name: null,
          kind: 'company',
          path: `${company.id}/`,
          is_active: 1,
        },
      ],
    })
    const member = await env.DB_GLOBAL.prepare('SELECT id FROM members WHERE tenant_id = ?')
      .bind(company.id)
      .first<{ id: string }>()
    expect(
      await env.DB_SHARD_1.prepare(
        'SELECT member_id, role_key, unit_id FROM assignments WHERE tenant_id = ?',
      )
        .bind(company.id)
        .all(),
    ).toMatchObject({
      results: [{ member_id: member?.id, role_key: 'owner', unit_id: company.id }],
    })
    expect(await (await context(token, slug)).json()).toEqual({
      name: valid.name,
      slug,
      role: 'owner',
    })
  })

  it.fails('@id:companies-90-7 keeps the chosen default language in the company profile', async () => {
    const { token } = await newSession()

    const company = await (
      await post(token, { body: { ...valid, slug: newSlug(), defaultLanguage: 'es' } })
    ).json<Company>()

    expect(
      await env.DB_SHARD_1.prepare(
        'SELECT default_language FROM company_profiles WHERE tenant_id = ?',
      )
        .bind(company.id)
        .first(),
    ).toEqual({ default_language: 'es' })
  })

  it.fails('@id:companies-90-1 keeps a long unicode name as sent, in NFC', async () => {
    const { token } = await newSession()
    const name = `Coöperativa Ñandú 日本 ${'é'.repeat(60)}`.slice(0, 80)

    const company = await (
      await post(token, {
        body: { ...valid, name: `  ${name.normalize('NFD')}  `, slug: newSlug() },
      })
    ).json<Company>()

    expect(company.name).toBe(name.normalize('NFC'))
  })

  it.fails('@id:companies-90-8 an account without a name keeps the one sent', async () => {
    const { token } = await newSession()
    expect(await (await me(token)).json()).toMatchObject({ name: null })

    await post(token, { body: { ...valid, slug: newSlug(), userName: 'Ana' } })

    expect(await (await me(token)).json()).toMatchObject({ name: 'Ana' })
  })

  it.fails('@id:companies-90-8 an account without a name cannot create a company without sending one', async () => {
    const { token, userId } = await newSession()
    const slug = newSlug()
    const { userName: _, ...withoutName } = valid

    await expectProblem(await post(token, { body: { ...withoutName, slug } }), {
      status: 400,
      code: 'companies.user_name_required',
    })
    expect(await companiesWithSlug(slug)).toBe(0)
    expect(await companiesOf(userId)).toBe(0)
  })

  it.fails('@id:companies-90-9 an account that has a name keeps it, whatever is sent', async () => {
    const { token, userId } = await newSession()
    await env.DB_GLOBAL.prepare("UPDATE users SET name = 'Ana' WHERE id = ?").bind(userId).run()

    const withName = await post(token, { body: { ...valid, slug: newSlug(), userName: 'Otra' } })
    const { userName: _, ...withoutName } = valid
    const withoutIt = await post(token, { body: { ...withoutName, slug: newSlug() } })

    expect(withName.status).toBe(201)
    expect(withoutIt.status).toBe(201)
    expect(await (await me(token)).json()).toMatchObject({ name: 'Ana' })
  })

  it.fails('@id:companies-90-3 a slug another company has answers 409 and writes nothing', async () => {
    const slug = newSlug('clinica-norte')
    await post((await newSession()).token, { body: { ...valid, slug } })
    const { token, userId } = await newSession()

    await expectProblem(await post(token, { body: { ...valid, slug } }), {
      status: 409,
      code: 'companies.slug_taken',
    })
    expect(await companiesWithSlug(slug)).toBe(1)
    expect(await companiesOf(userId)).toBe(0)
  })

  it.fails('@id:companies-90-3 the slug of a company being deleted stays taken', async () => {
    const slug = newSlug()
    await post((await newSession()).token, { body: { ...valid, slug } })
    await env.DB_GLOBAL.prepare("UPDATE companies SET status = 'deleting' WHERE slug = ?")
      .bind(slug)
      .run()

    await expectProblem(await post((await newSession()).token, { body: { ...valid, slug } }), {
      status: 409,
      code: 'companies.slug_taken',
    })
  })

  it.fails('@id:companies-90-4 a reserved slug answers 400 reserved_slug and writes nothing', async () => {
    const { token, userId } = await newSession()

    await expectProblem(await post(token, { body: { ...valid, slug: 'api' } }), {
      status: 400,
      code: 'companies.reserved_slug',
    })
    expect(await companiesOf(userId)).toBe(0)
  })

  it.fails('@id:companies-90-5 an invalid slug answers 400 invalid_slug and writes nothing', async () => {
    const { token, userId } = await newSession()

    for (const slug of ['ab', 'mi--empresa', '-norte', 'norte-stg', 'Norte', 'a'.repeat(41)])
      await expectProblem(await post(token, { body: { ...valid, slug } }), {
        status: 400,
        code: 'companies.invalid_slug',
      })
    expect(await companiesOf(userId)).toBe(0)
  })

  it.fails('@id:companies-90-1 refuses fields the client may not set, a bad name or language, and writes nothing', async () => {
    const { token, userId } = await newSession()
    const slug = newSlug()

    for (const body of [
      { ...valid, slug, status: 'trialing' },
      { ...valid, slug, shardId: 'shard-2' },
      { ...valid, slug, role: 'owner' },
      { ...valid, slug, id: '01940000-0000-7000-8000-000000000001' },
      { ...valid, slug, name: 'North‮wind' },
      { ...valid, slug, name: 'North\u0000wind' },
      { ...valid, slug, name: 'a'.repeat(81) },
      { ...valid, slug, name: '   ' },
      { ...valid, slug, userName: 'A⁦na' },
      { ...valid, slug, defaultLanguage: 'fr' },
      { ...valid, slug, name: null },
      [],
      null,
    ])
      await expectProblem(await post(token, { body: body }), {
        status: 400,
        code: 'companies.invalid_request',
      })
    expect(await companiesWithSlug(slug)).toBe(0)
    expect(await companiesOf(userId)).toBe(0)
  })

  it.fails('@id:companies-90-11 a missing or malformed Idempotency-Key answers 400 and writes nothing', async () => {
    const { token, userId } = await newSession()
    const slug = newSlug()

    for (const key of [
      null,
      '',
      'abc',
      `${crypto.randomUUID()}x`,
      'not-a-uuid-at-all-0000000000000000',
    ])
      await expectProblem(await post(token, { body: { ...valid, slug }, key }), {
        status: 400,
        code: 'companies.invalid_request',
      })
    expect(await companiesWithSlug(slug)).toBe(0)
    expect(await companiesOf(userId)).toBe(0)
  })

  it('@id:companies-90-1 a cross-site text/plain post is refused with 403 and writes nothing', async () => {
    const { token } = await newSession()
    const slug = newSlug()

    const response = await post(token, {
      body: JSON.stringify({ ...valid, slug }),
      headers: { 'Content-Type': 'text/plain', Origin: 'https://evil.test' },
    })

    expect(response.status).toBe(403)
    expect(await companiesWithSlug(slug)).toBe(0)
  })

  it.fails('@id:companies-90-1 accepts only a JSON body', async () => {
    const { token } = await newSession()
    const slug = newSlug()

    const response = await post(token, {
      body: JSON.stringify({ ...valid, slug }),
      headers: { 'Content-Type': 'text/plain', Origin: ORIGIN },
    })

    expect([400, 415]).toContain(response.status)
    expect(await companiesWithSlug(slug)).toBe(0)
  })

  it.fails('@id:companies-90-12 without a session answers 401 and writes nothing', async () => {
    const slug = newSlug()

    await expectProblem(await post(undefined, { body: { ...valid, slug } }), {
      status: 401,
      code: 'access.unauthenticated',
    })
    expect(await companiesWithSlug(slug)).toBe(0)
  })

  it.fails('@id:companies-90-1 logs neither the request body nor the names', async () => {
    const logs = [
      vi.spyOn(console, 'log').mockImplementation(() => {}),
      vi.spyOn(console, 'info').mockImplementation(() => {}),
      vi.spyOn(console, 'warn').mockImplementation(() => {}),
      vi.spyOn(console, 'error').mockImplementation(() => {}),
    ]
    const { token } = await newSession()
    const name = `Secret Name ${crypto.randomUUID()}`

    const response = await post(token, {
      body: {
        ...valid,
        name,
        userName: 'Secret Person',
        slug: newSlug(),
      },
    })

    expect(response.status).toBe(201)
    const written = JSON.stringify(logs.flatMap((log) => log.mock.calls))
    expect(written).not.toContain(name)
    expect(written).not.toContain('Secret Person')
  })
})

describe('POST /api/companies when the same slug or request arrives twice', () => {
  it.fails('@id:companies-90-10 two people sending the same slug at once leave one company, one member and one contact', async () => {
    const [ana, bea] = await Promise.all([newSession(), newSession()])
    const slug = newSlug('sol')

    const answers = await Promise.all([
      post(ana.token, { body: { ...valid, slug } }),
      post(bea.token, { body: { ...valid, slug } }),
    ])

    expect(answers.map((a) => a.status).sort()).toEqual([201, 409])
    const loser = answers.find((a) => a.status === 409)
    if (loser) await expectProblem(loser, { status: 409, code: 'companies.slug_taken' })
    const company = await env.DB_GLOBAL.prepare('SELECT id FROM companies WHERE slug = ?')
      .bind(slug)
      .first<{ id: string }>()
    expect(await companiesWithSlug(slug)).toBe(1)
    expect(await count('members', ['tenant_id', company?.id])).toBe(1)
    expect(await count('company_contacts', ['tenant_id', company?.id])).toBe(1)
  })

  it.fails('@id:companies-90-11 a half-created company is completed once by the same request', async () => {
    const { token } = await newSession()
    const key = crypto.randomUUID()
    const body = { ...valid, slug: newSlug() }
    const first = await (await post(token, { body: body, key })).json<Company>()
    // The shard batch never landed: only the global rows stay.
    await env.DB_SHARD_1.batch([
      env.DB_SHARD_1.prepare('DELETE FROM assignments WHERE tenant_id = ?').bind(first.id),
      env.DB_SHARD_1.prepare('DELETE FROM company_profiles WHERE tenant_id = ?').bind(first.id),
      env.DB_SHARD_1.prepare('DELETE FROM units WHERE tenant_id = ?').bind(first.id),
    ])
    expect((await context(token, body.slug)).status).toBe(404)

    const again = await post(token, { body: body, key })

    expect(again.status).toBe(201)
    expect(await again.json()).toEqual(first)
    expect(await shardRows(first.id)).toEqual({ units: 1, assignments: 1, profiles: 1 })
    expect(await companiesWithSlug(body.slug)).toBe(1)
    expect(await (await context(token, body.slug)).json()).toMatchObject({ role: 'owner' })
  })

  it.fails('@id:companies-90-11 replaying a complete request returns the same company and writes nothing more', async () => {
    const { token, userId } = await newSession()
    const key = crypto.randomUUID()
    const body = { ...valid, slug: newSlug() }
    const first = await (await post(token, { body: body, key })).json<Company>()

    const again = await post(token, { body: body, key })

    expect(again.status).toBe(201)
    expect(await again.json()).toEqual(first)
    expect(await shardRows(first.id)).toEqual({ units: 1, assignments: 1, profiles: 1 })
    expect(await companiesOf(userId)).toBe(1)
  })

  it.fails('@id:companies-90-11 the same request sent twice at once creates one company and answers it to both', async () => {
    const { token, userId } = await newSession()
    const key = crypto.randomUUID()
    const body = { ...valid, slug: newSlug() }

    const answers = await Promise.all([
      post(token, { body: body, key }),
      post(token, { body: body, key }),
    ])

    expect(answers.map((a) => a.status)).toEqual([201, 201])
    const [a, b] = await Promise.all(answers.map((answer) => answer.json<Company>()))
    expect(a).toEqual(b)
    expect(await companiesOf(userId)).toBe(1)
    expect(await shardRows(a?.id ?? '')).toEqual({ units: 1, assignments: 1, profiles: 1 })
  })

  it.fails('@id:companies-90-11 the same key with another body answers 422 and writes nothing', async () => {
    const { token, userId } = await newSession()
    const key = crypto.randomUUID()
    await post(token, { body: { ...valid, slug: newSlug() }, key })
    const other = newSlug('otra')

    await expectProblem(await post(token, { body: { ...valid, slug: other }, key }), {
      status: 422,
      code: 'companies.idempotency_mismatch',
    })
    expect(await companiesWithSlug(other)).toBe(0)
    expect(await companiesOf(userId)).toBe(1)
  })

  it.fails("@id:companies-90-11 another person's key never returns their company", async () => {
    const ana = await newSession()
    const key = crypto.randomUUID()
    const body = { ...valid, slug: newSlug() }
    await post(ana.token, { body: body, key })
    const bea = await newSession()

    const sameBody = await post(bea.token, { body: body, key })
    const otherBody = await post(bea.token, { body: { ...valid, slug: newSlug('bea') }, key })

    await expectProblem(sameBody, { status: 409, code: 'companies.slug_taken' })
    expect(otherBody.status).toBe(201)
    expect(await companiesOf(ana.userId)).toBe(1)
    expect(await companiesOf(bea.userId)).toBe(1)
  })
})

describe('POST /api/companies over the rate limit', () => {
  it.fails('@id:companies-90-1 over the per-user threshold answers 429 and writes nothing', async () => {
    const { token, userId } = await newSession()
    const bindings = Object.assign({}, env, { [USER_LIMIT]: '1', [IP_LIMIT]: '1000' })
    const slug = newSlug()

    expect((await post(token, { body: { ...valid, slug: newSlug() }, bindings })).status).toBe(201)
    const over = await post(token, { body: { ...valid, slug }, bindings })

    expect(over.status).toBe(429)
    expect(await companiesWithSlug(slug)).toBe(0)
    expect(await companiesOf(userId)).toBe(1)
  })

  it.fails('@id:companies-90-1 over the per-IP threshold answers 429 to anyone from that IP', async () => {
    const ip = newIp()
    const bindings = Object.assign({}, env, { [USER_LIMIT]: '1000', [IP_LIMIT]: '1' })
    const slug = newSlug()
    const bea = await newSession()

    expect(
      (
        await post((await newSession()).token, {
          body: { ...valid, slug: newSlug() },
          ip,
          bindings,
        })
      ).status,
    ).toBe(201)
    const over = await post(bea.token, { body: { ...valid, slug }, ip, bindings })

    expect(over.status).toBe(429)
    expect(await companiesWithSlug(slug)).toBe(0)
    expect(await companiesOf(bea.userId)).toBe(0)
  })

  it.fails('@id:companies-90-11 a replay that returns the existing company does not count', async () => {
    const { token } = await newSession()
    const bindings = Object.assign({}, env, { [USER_LIMIT]: '1', [IP_LIMIT]: '1000' })
    const key = crypto.randomUUID()
    const body = { ...valid, slug: newSlug() }

    expect((await post(token, { body: body, key, bindings })).status).toBe(201)
    const replays = [
      await post(token, { body: body, key, bindings }),
      await post(token, { body: body, key, bindings }),
    ]

    expect(replays.map((r) => r.status)).toEqual([201, 201])
  })
})
