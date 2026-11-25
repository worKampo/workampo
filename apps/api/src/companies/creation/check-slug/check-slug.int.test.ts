import { env, exports } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { newEmail, sessionToken, signIn } from '../../../_shared/testing/api-requests'

const ORIGIN = 'https://app.test'
const newSlug = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`

const newSession = async () => sessionToken(await signIn({ email: newEmail() }))

function check(slug: string, token?: string) {
  return exports.default.fetch(
    `${ORIGIN}/api/companies/availability?slug=${encodeURIComponent(slug)}`,
    {
      headers: token ? { Cookie: `__Host-session=${token}` } : {},
    },
  )
}

async function createCompany(slug: string) {
  const response = await exports.default.fetch(`${ORIGIN}/api/companies`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `__Host-session=${await newSession()}`,
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({
      name: 'Secret Company Name',
      slug,
      defaultLanguage: 'es',
      userName: 'Ana',
    }),
  })
  expect(response.status).toBe(201)
}

async function expectProblem(response: Response, code: string) {
  expect(response.status).toBe(400)
  expect(await response.json()).toMatchObject({ code })
}

describe('GET /api/companies/availability?slug=', () => {
  it('@id:companies-90-2 a free slug is available', async () => {
    const response = await check(newSlug('clinica-norte'), await newSession())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ available: true })
  })

  it('@id:companies-90-3 a taken slug is not available and the answer says nothing else', async () => {
    const slug = newSlug('clinica-norte')
    await createCompany(slug)

    const response = await check(slug, await newSession())

    expect(response.status).toBe(200)
    const text = await response.text()
    expect(JSON.parse(text)).toEqual({ available: false })
    expect(text).not.toContain('Secret Company Name')
  })

  it('@id:companies-90-3 the slug of a company being deleted is not available', async () => {
    const slug = newSlug('borrando')
    await createCompany(slug)
    await env.DB_GLOBAL.prepare("UPDATE companies SET status = 'deleting' WHERE slug = ?")
      .bind(slug)
      .run()

    expect(await (await check(slug, await newSession())).json()).toEqual({ available: false })
  })

  it('@id:companies-90-4 a reserved slug answers 400 reserved_slug', async () => {
    const token = await newSession()

    for (const slug of ['api', 'www', 'workampo', 'login'])
      await expectProblem(await check(slug, token), 'companies.reserved_slug')
  })

  it('@id:companies-90-5 an invalid slug answers 400 invalid_slug', async () => {
    const token = await newSession()

    for (const slug of [
      'ab',
      'mi--empresa',
      '-norte',
      'norte-stg',
      'Norte',
      'clínica',
      'a'.repeat(41),
    ])
      await expectProblem(await check(slug, token), 'companies.invalid_slug')
  })

  it('@id:companies-90-12 without a session answers 401, even for a valid slug', async () => {
    const response = await check(newSlug('sin-sesion'))

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ code: 'access.unauthenticated' })
  })
})
