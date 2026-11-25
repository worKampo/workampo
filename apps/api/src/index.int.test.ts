import { env, exports } from 'cloudflare:workers'
import { ACCESS_ERROR_CODES } from '@workampo/domain/access/errors'
import { ERROR_CODES } from '@workampo/domain/errors'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { me, newEmail, newIp, sessionToken, signIn } from './_shared/testing/api-requests'
import { AccessError } from './access/errors'
import { CompaniesError } from './companies/errors'
import { app } from './index'

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

it('answers /health with status, sha, version and environment', async () => {
  const response = await exports.default.fetch('https://app.test/health')

  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({
    status: 'ok',
    sha: 'local',
    version: expect.any(String),
    environment: 'local',
  })
})

it('answers /health with the deployed environment', async () => {
  for (const environment of ['stg', 'prod'] as const) {
    const response = await app.request('/health', {}, { ...env, ENVIRONMENT: environment })

    expect(await response.json()).toMatchObject({ environment })
  }
})

it('answers /health with GIT_SHA when the version has no tag', async () => {
  const response = await app.request(
    '/health',
    {},
    { ...env, CF_VERSION_METADATA: { ...env.CF_VERSION_METADATA, tag: '' }, GIT_SHA: 'abc1234' },
  )

  expect(await response.json()).toMatchObject({ sha: 'abc1234' })
})

it('does not set X-App-Version without APP_VERSION', async () => {
  const response = await exports.default.fetch('https://app.test/health')

  expect(response.headers.has('X-App-Version')).toBe(false)
})

it('logs only the client version and the method', async () => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})

  await exports.default.fetch('https://app.test/health?token=secret', {
    headers: { 'X-Client-Version': 'abc123', 'X-Other': 'nope' },
  })

  expect(log).toHaveBeenCalledTimes(1)
  expect(JSON.parse(log.mock.calls[0]?.[0] as string)).toEqual({
    clientVersion: 'abc123',
    method: 'GET',
  })
})

it('logs nothing when X-Client-Version is not a build hash or version', async () => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})

  for (const clientVersion of ['a b', 'v1"}', 'x'.repeat(65)]) {
    await exports.default.fetch('https://app.test/health', {
      headers: { 'X-Client-Version': clientVersion },
    })
  }

  expect(log).not.toHaveBeenCalled()
})

it('logs a 64-character client version', async () => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})

  await exports.default.fetch('https://app.test/health', {
    headers: { 'X-Client-Version': 'a'.repeat(64) },
  })

  expect(log).toHaveBeenCalledTimes(1)
})

it('logs nothing without X-Client-Version', async () => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})

  await exports.default.fetch('https://app.test/health')

  expect(log).not.toHaveBeenCalled()
})

it('answers 404 on /__debug/error without ENABLE_DEBUG_ERROR', async () => {
  const response = await exports.default.fetch('https://app.test/__debug/error')

  expect(response.status).toBe(404)
})

it('throws on /__debug/error with ENABLE_DEBUG_ERROR', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})

  const response = await app.request('/__debug/error', {}, { ...env, ENABLE_DEBUG_ERROR: 'true' })

  expect(response.status).toBe(500)
})

// i#171, ADR-0078 sections 3, 6, 8 and 10.
function startCode(
  init: { body?: string; email?: string; ip?: string } = {},
  bindings?: typeof env,
) {
  const request = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': init.ip ?? newIp() },
    body: init.body ?? JSON.stringify({ email: init.email ?? newEmail() }),
  }

  return bindings
    ? app.request('https://app.test/api/sign-in-codes', request, bindings)
    : exports.default.fetch('https://app.test/api/sign-in-codes', request)
}

async function expectProblem(
  response: Response,
  { status, code, title }: { status: number; code: string; title: string },
) {
  expect(response.status).toBe(status)
  expect(response.headers.get('Content-Type')).toContain('application/problem+json')
  expect(await response.json()).toMatchObject({ status, code, title })
}

it('a malformed JSON body answers 400 problem+json with api.malformed_json', async () => {
  await expectProblem(await startCode({ body: '{"email":' }), {
    status: 400,
    code: 'api.malformed_json',
    title: 'Bad Request',
  })
})

it('an unknown /api path answers 404 problem+json with api.not_found for any method', async () => {
  for (const method of ['GET', 'POST']) {
    // Same-origin, as the clients send it: csrf() refuses a POST without Origin before routing.
    const response = await exports.default.fetch('https://app.test/api/nothing-here', {
      method,
      headers: { Origin: 'https://app.test' },
    })

    await expectProblem(response, { status: 404, code: 'api.not_found', title: 'Not Found' })
  }
})

it('every problem+json carries the HTTP reason phrase as title', async () => {
  // A fixed instant mid-window, so both requests fall in the same rate-limit window.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-01-01T00:00:30.000Z'))
  const unauthorized = await me(undefined)
  expect(unauthorized.status).toBe(401)
  expect(await unauthorized.json()).toMatchObject({ title: 'Unauthorized' })

  const bindings = Object.assign({}, env, { RATE_LIMIT_CODE_REQUESTS_PER_EMAIL: '1' })
  const email = newEmail()
  expect((await startCode({ email }, bindings)).status).toBe(202)
  expect(await (await startCode({ email }, bindings)).json()).toMatchObject({
    title: 'Too Many Requests',
  })
})

it('a 429 carries Retry-After in whole seconds within the rate-limit window', async () => {
  // A fixed instant mid-window, so both requests fall in the same rate-limit window.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-01-01T00:00:30.000Z'))
  const bindings = Object.assign({}, env, { RATE_LIMIT_CODE_REQUESTS_PER_EMAIL: '1' })
  const email = newEmail()
  expect((await startCode({ email }, bindings)).status).toBe(202)

  const response = await startCode({ email }, bindings)

  expect(response.status).toBe(429)
  const retryAfter = response.headers.get('Retry-After') ?? ''
  expect(retryAfter).toMatch(/^\d+$/)
  expect(Number(retryAfter)).toBeGreaterThanOrEqual(1)
  expect(Number(retryAfter)).toBeLessThanOrEqual(Number(env.RATE_LIMIT_WINDOW_SECONDS))
})

it('/api responses, success and error, carry no-store and nosniff', async () => {
  const responses = [await startCode(), await me(undefined)]

  expect(responses.map((response) => response.status)).toEqual([202, 401])
  for (const response of responses) {
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
  }
})

it('a JSON body over 100 KB answers 413 problem+json with api.body_too_large', async () => {
  const body = JSON.stringify({ email: 'a'.repeat(100 * 1024) })

  await expectProblem(await startCode({ body }), {
    status: 413,
    code: 'api.body_too_large',
    title: 'Payload Too Large',
  })
})

it('/api without a trailing slash answers 404 problem+json too', async () => {
  const response = await exports.default.fetch('https://app.test/api')

  await expectProblem(response, { status: 404, code: 'api.not_found', title: 'Not Found' })
})

it('the answer of csrf() also carries no-store and nosniff', async () => {
  const response = await exports.default.fetch('https://app.test/api/sign-in-codes', {
    method: 'POST',
    headers: { Origin: 'https://evil.test', 'Content-Type': 'text/plain' },
    body: '{}',
  })

  expect(response.status).toBe(403)
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
})

// docs/process/code-conventions.md, "API URLs and contracts" (ADR-0078): the rows marked "check".

const ORIGIN = 'https://app.test'
const METHODS = ['GET', 'POST', 'PATCH', 'DELETE']
const BINARY_SINGLETONS = ['logo', 'avatar']
// Non-plural last segments that name a thing; any other one is an action, POST only.
const SINGLETONS_AND_ALIASES = ['me', 'current', 'availability', ...BINARY_SINGLETONS]
const PARAM_EXCEPTIONS = [':slug', ':token', ':provider']
const SEGMENT = /^([a-z0-9]+(-[a-z0-9]+)*|:[a-z][a-zA-Z]*)$/

// Routes whose URL someone else fixes, so the shape rules do not apply.
const EXCEPTIONS: Record<string, string> = {
  'GET /api/sessions/google': 'a browser navigation that starts the Google redirect',
  'GET /api/sessions/google/callback': 'the redirect URI registered with Google',
  'GET /api/sessions/google/fake-consent': "the fake provider's consent page, local bundle only",
  'POST /api/webhooks/:provider': 'each provider calls the URL we register with it',
}

// Reachable without a session: they are how a person gets one.
const PUBLIC_ROUTES = [
  'POST /api/sign-in-codes',
  'POST /api/sessions',
  'GET /api/sessions/google',
  'GET /api/sessions/google/callback',
  'GET /api/sessions/google/fake-consent',
]

const CREATE_EXEMPT: Record<string, string> = {
  'POST /api/sign-in-codes': 'a new code each time is the intent; a retry only sends another',
  'POST /api/sessions': 'a retried sign-in opens one more session, which expires on its own',
}

// A valid body per creating POST, so the 400 comes from the missing key and not from the body.
const CREATE_BODIES: Record<string, unknown> = {
  'POST /api/companies': {
    name: 'Northwind Logistics',
    slug: 'northwind-contract',
    defaultLanguage: 'es',
    userName: 'Ana',
  },
}

// Middleware registers method ALL or a wildcard; Hono leaves a trailing slash on mounted roots.
const ROUTES = [
  ...new Set(
    app.routes
      .filter((route) => route.method !== 'ALL' && !route.path.includes('*'))
      .filter((route) => route.path.startsWith('/api/'))
      .map((route) => `${route.method} ${route.path.replace(/\/$/, '')}`),
  ),
]

const isTenantPath = (path: string) => /^\/api\/t\/:slug(\/|$)/.test(path)
const isPlural = (segment: string) => segment.endsWith('s')

function brokenRules(route: string): string[] {
  const [method = '', path = ''] = route.split(' ')
  const tenant = isTenantPath(path)
  const segments = path
    .slice(tenant ? '/api/t/:slug'.length : '/api'.length)
    .split('/')
    .filter(Boolean)
  const last = segments.at(-1) ?? ''
  const lastIsName = !last.startsWith(':') && !isPlural(last) && segments.length > 0
  const params = segments.filter((segment) => segment.startsWith(':'))
  const broken: string[] = []

  if (!(METHODS.includes(method) || (method === 'PUT' && BINARY_SINGLETONS.includes(last))))
    broken.push('method')
  if (!segments.every((segment) => SEGMENT.test(segment))) broken.push('segment spelling')
  const alternates = segments.every((segment, index) => {
    if (index === segments.length - 1 && lastIsName) return true
    if (index % 2 === 1) return segment.startsWith(':')

    return !segment.startsWith(':') && isPlural(segment)
  })
  if (!alternates) broken.push('collection and :param alternate; a non-plural literal only last')
  if (lastIsName && !SINGLETONS_AND_ALIASES.includes(last) && method !== 'POST')
    broken.push('an action only with POST')
  if (tenant && params.length > 2) broken.push('at most two params after /api/t/:slug')
  const paramsNamed = params.every(
    (param, index) =>
      PARAM_EXCEPTIONS.includes(param) ||
      (index === params.length - 1 ? param === ':id' : /^:[a-z][a-zA-Z]*Id$/.test(param)),
  )
  if (!paramsNamed) broken.push('the last param :id, earlier ones :<x>Id')
  if (!tenant && segments[0] === 'companies' && segments[1]?.startsWith(':'))
    broken.push('no /api/companies/:x on the app Worker')
  if (!tenant && segments.includes(':slug')) broken.push(':slug only in /api/t/:slug')

  return broken
}

function concreteUrl(route: string, slug: string) {
  const path = (route.split(' ')[1] ?? '')
    .replace(':slug', slug)
    .replace(/:\w+/g, () => crypto.randomUUID())

  return `${ORIGIN}${path}`
}

function call(
  route: string,
  {
    slug,
    token,
    body = {},
    headers = {},
  }: {
    slug: string
    token?: string
    body?: unknown
    headers?: Record<string, string>
  },
) {
  const method = route.split(' ')[0] ?? 'GET'
  const hasBody = !['GET', 'DELETE'].includes(method)

  return exports.default.fetch(concreteUrl(route, slug), {
    method,
    headers: {
      Origin: ORIGIN,
      'CF-Connecting-IP': newIp(),
      ...(hasBody && { 'Content-Type': 'application/json' }),
      ...(token && { Cookie: `__Host-session=${token}` }),
      ...headers,
    },
    ...(hasBody && { body: JSON.stringify(body) }),
  })
}

async function newSession() {
  return sessionToken(await signIn({ email: newEmail() }))
}

async function createCompany(token: string) {
  const slug = `contract-${crypto.randomUUID().slice(0, 8)}`
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

  return slug
}

async function answer(response: Response) {
  return {
    status: response.status,
    contentType: response.headers.get('Content-Type'),
    cacheControl: response.headers.get('Cache-Control'),
    nosniff: response.headers.get('X-Content-Type-Options'),
    body: await response.json().catch(() => null),
  }
}

const problem = (status: number) => ({
  status,
  contentType: expect.stringContaining('application/problem+json'),
  cacheControl: 'no-store',
  nosniff: 'nosniff',
  body: { type: 'about:blank', title: expect.any(String), status, code: expect.any(String) },
})

describe('every API route', () => {
  it('follows the URL and method rules', () => {
    const broken = ROUTES.filter((route) => !(route in EXCEPTIONS))
      .map((route) => ({ route, broken: brokenRules(route) }))
      .filter(({ broken }) => broken.length > 0)

    expect(broken).toEqual([])
  })

  it('outside the public list answers 401 problem+json without a session', async () => {
    const routes = ROUTES.filter((route) => !PUBLIC_ROUTES.includes(route))
    expect(routes.length).toBeGreaterThan(0)

    for (const route of routes) {
      const response = await call(route, { slug: 'any-company' })

      expect({ route, ...(await answer(response)) }).toEqual({ route, ...problem(401) })
    }
  })

  it('under /api/t/:slug answers 404 problem+json to a session that is not a member', async () => {
    const slug = await createCompany(await newSession())
    const stranger = await newSession()
    const routes = ROUTES.filter((route) => isTenantPath(route.split(' ')[1] ?? ''))
    expect(routes.length).toBeGreaterThan(0)

    for (const route of routes) {
      const response = await call(route, { slug, token: stranger })

      expect({ route, ...(await answer(response)) }).toEqual({ route, ...problem(404) })
    }
  })

  it('that creates answers 400 problem+json without Idempotency-Key', async () => {
    const owner = await newSession()
    const slug = await createCompany(owner)
    const routes = ROUTES.filter((route) => {
      const [method, path = ''] = route.split(' ')

      return (
        method === 'POST' && isPlural(path.split('/').at(-1) ?? '') && !(route in CREATE_EXEMPT)
      )
    })
    expect(routes).toEqual(Object.keys(CREATE_BODIES))

    for (const route of routes) {
      const response = await call(route, { slug, token: owner, body: CREATE_BODIES[route] })

      expect({ route, ...(await answer(response)) }).toEqual({ route, ...problem(400) })
    }
  })
})

describe('every domain error status', () => {
  const ALLOWED = [400, 401, 403, 404, 409, 413, 415, 422, 429, 502, 503]
  const statuses = [
    ...ACCESS_ERROR_CODES.map((code) => ({ code, status: new AccessError(code).status })),
    ...ERROR_CODES.filter((code) => code.startsWith('companies.')).map((code) => ({
      code,
      status: new CompaniesError(code as ConstructorParameters<typeof CompaniesError>[0]).status,
    })),
  ]

  it('is one of the allowed statuses', () => {
    expect(statuses.filter(({ status }) => !ALLOWED.includes(status))).toEqual([])
  })

  it('is 422 only for a reused Idempotency-Key with another body', () => {
    const misused = statuses.filter(
      ({ code, status }) => (status === 422) !== code.endsWith('.idempotency_mismatch'),
    )

    expect(misused).toEqual([])
  })
})
