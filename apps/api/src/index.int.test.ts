import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test'
import { env, exports } from 'cloudflare:workers'
import { ERROR_REFERENCE } from '@workampo/domain/_shared/api-errors'
import { ACCESS_ERROR_CODES } from '@workampo/domain/access/errors'
import { ERROR_CODES } from '@workampo/domain/errors'
import { Hono } from 'hono'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { clientVersionLog } from './_shared/client-version/client-version-log'
import { parsedEnv, parseEnv } from './_shared/env'
import { errorTracking } from './_shared/error-tracking/sentry-error-tracking'
import { apiOnError, apiResponseHeaders } from './_shared/http/api-behaviour'
import type { AppEnv } from './_shared/http/app-env'
import { me, newEmail, newIp, sessionToken, signIn } from './_shared/testing/api-requests'
import { AccessError } from './access/errors'
import { requireSession } from './access/require-session.middleware'
import { CompaniesError } from './companies/errors'
import { requireMember } from './companies/require-member.middleware'
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
// Last segments that name a thing rather than a collection: singletons, aliases, collection checks.
const SINGLETONS_AND_ALIASES = ['me', 'current', 'availability', ...BINARY_SINGLETONS]
// Action verbs (ADR-0078 rule 2.7), POST only; listed, since a verb may end in s (enable-writes).
const ACTIONS = ['resend', 'move', 'deactivate', 'enable-writes', 'accept']
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
// A collection: plural, and neither an action nor a singleton (a verb may end in s).
const isCollection = (segment: string) =>
  segment.endsWith('s') && !ACTIONS.includes(segment) && !SINGLETONS_AND_ALIASES.includes(segment)

function brokenRules(route: string): string[] {
  const [method = '', path = ''] = route.split(' ')
  const tenant = isTenantPath(path)
  const segments = path
    .slice(tenant ? '/api/t/:slug'.length : '/api'.length)
    .split('/')
    .filter(Boolean)
  const last = segments.at(-1) ?? ''
  const lastIsAction = ACTIONS.includes(last)
  const lastIsName = lastIsAction || SINGLETONS_AND_ALIASES.includes(last)
  const broken: string[] = []

  if (!(METHODS.includes(method) || (method === 'PUT' && BINARY_SINGLETONS.includes(last))))
    broken.push('method')
  if (!segments.every((segment) => SEGMENT.test(segment))) broken.push('segment spelling')
  const alternates = segments.every((segment, index) => {
    if (index === segments.length - 1 && lastIsName) return true
    if (index % 2 === 1) return segment.startsWith(':')

    return !segment.startsWith(':') && isCollection(segment)
  })
  if (!alternates) broken.push('collection and :param alternate; a non-plural literal only last')
  if (lastIsAction && method !== 'POST') broken.push('an action only with POST')
  const params = segments.filter((segment) => segment.startsWith(':'))
  if (tenant && params.length > 2) broken.push('at most two params after /api/t/:slug')
  // By position in the path: a param that ends the path or comes before an action or singleton
  // names the item (:id); one followed by a child collection names a parent (:<x>Id).
  const paramsNamed = segments.every((segment, index) => {
    if (!segment.startsWith(':') || PARAM_EXCEPTIONS.includes(segment)) return true
    const next = segments[index + 1]
    const namesItem =
      next === undefined || ACTIONS.includes(next) || SINGLETONS_AND_ALIASES.includes(next)

    return namesItem ? segment === ':id' : /^:[a-z][a-zA-Z]*Id$/.test(segment)
  })
  if (!paramsNamed) broken.push('an item param :id, a parent param :<x>Id')
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
        method === 'POST' && isCollection(path.split('/').at(-1) ?? '') && !(route in CREATE_EXEMPT)
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

it('the route check itself tells nested collections and actions apart', () => {
  for (const ok of [
    'GET /api/t/:slug/units/:id',
    'GET /api/t/:slug/units/:unitId/members',
    'GET /api/t/:slug/units/:unitId/members/:id',
    'POST /api/t/:slug/units/:id/enable-writes',
    'GET /api/t/:slug/permissions',
  ])
    expect(brokenRules(ok), ok).toEqual([])

  expect(brokenRules('GET /api/t/:slug/units/:id/enable-writes')).toContain(
    'an action only with POST',
  )
  expect(brokenRules('GET /api/t/:slug/units/:id/members')).toContain(
    'an item param :id, a parent param :<x>Id',
  )
  expect(brokenRules('POST /api/t/:slug/enable-writes/:id/members')).toContain(
    'collection and :param alternate; a non-plural literal only last',
  )
})

// Ticket 93: the error reference (ADR-0078 sections 6 and 8.3, Update). A made-up DSN on a test
// domain; the spied fetch answers it, so nothing leaves the test (ADR-0043).
const TEST_DSN = 'https://public@sentry.test/1'
const MADE_UP_CF_RAY = '8f2a1b3c4d5e6f70-MAD'

// Wired like index.ts, plus routes that fail with personal data in the message.
function failingApp() {
  const failing = new Hono<AppEnv>()
  failing.use(errorTracking(failing))
  failing.use(clientVersionLog)
  failing.use('/api/*', apiResponseHeaders)
  failing.use('/api/*', parsedEnv)
  failing.use('/api/t/:slug/*', requireSession, requireMember)
  failing.get('/api/x', () => {
    throw new Error('secret a@b.test')
  })
  failing.get('/api/t/:slug/x', () => {
    throw new Error('secret a@b.test')
  })
  failing.onError(apiOnError)

  return failing
}

async function failWith(
  path: string,
  {
    headers = {},
    freshClient = true,
  }: { headers?: Record<string, string>; freshClient?: boolean } = {},
) {
  // Sentry caches one client per isolate under this key; an earlier test's has no DSN and would win.
  if (freshClient) Reflect.deleteProperty(globalThis, '__SENTRY_CLOUDFLARE_CLIENT__')
  const ctx = createExecutionContext()
  const response = await failingApp().request(
    `${ORIGIN}${path}`,
    { headers },
    { ...env, SENTRY_DSN: TEST_DSN },
    ctx,
  )
  await waitOnExecutionContext(ctx)

  return response
}

// The bodies sent to the test DSN's host; any other fetch goes through.
function spySentry() {
  const realFetch = globalThis.fetch.bind(globalThis)
  const envelopes: string[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const request = new Request(input, init)
    if (new URL(request.url).hostname !== 'sentry.test') return realFetch(input, init)
    envelopes.push(await request.text())

    return new Response('{}')
  })

  return envelopes
}

type SentryEvent = { tags?: Record<string, unknown>; request?: { url?: string } }

const parseLine = (line: string): unknown => {
  try {
    return JSON.parse(line)
  } catch {
    return null
  }
}

// An envelope is a header line, then item header and payload lines; the event has an exception.
const sentryEvents = (envelopes: string[]) =>
  envelopes
    .flatMap((envelope) => envelope.split('\n').map(parseLine))
    .filter(
      (item): item is SentryEvent => !!item && typeof item === 'object' && 'exception' in item,
    )

// The failure's log lines, which are JSON so Workers logs index their fields.
const failureLogs = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls
    .map(([line]) => (typeof line === 'string' ? parseLine(line) : null))
    .filter((item) => !!item && typeof item === 'object' && 'reference' in item)

describe('the error reference', () => {
  // The cached client of these tests holds the test DSN; later files must build their own.
  afterAll(() => {
    Reflect.deleteProperty(globalThis, '__SENTRY_CLOUDFLARE_CLIENT__')
  })

  it('R4 a failing /api route keeps no-store, nosniff and problem+json, with its reference', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    spySentry()

    const response = await failWith('/api/x')

    expect(response.status).toBe(500)
    expect(response.headers.get('Content-Type')).toContain('application/problem+json')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(await response.json()).toMatchObject({
      code: 'api.unexpected',
      reference: expect.stringMatching(ERROR_REFERENCE),
    })
  })

  it('R5 R6 the log and Sentry carry the body reference, and neither the query nor the message', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const envelopes = spySentry()

    const response = await failWith('/api/x?returnTo=%2Fc%2Fnorthwind&q=ana', {
      headers: { 'CF-Ray': MADE_UP_CF_RAY },
    })
    const { reference } = await response.json<{ reference: string }>()

    expect(reference).toMatch(ERROR_REFERENCE)
    expect(failureLogs(error)).toEqual([
      { reference, cfRay: MADE_UP_CF_RAY, code: 'api.unexpected', companyId: null },
    ])
    const logged = JSON.stringify(error.mock.calls)
    for (const leak of ['returnTo', 'ana', 'northwind', 'secret', 'a@b.test', '/api/x']) {
      expect(logged).not.toContain(leak)
    }
    await vi.waitFor(() => expect(sentryEvents(envelopes)).toHaveLength(1))
    const [event] = sentryEvents(envelopes)
    expect(event?.tags?.reference).toBe(reference)
    expect(event?.request?.url ?? '').not.toContain('?')
    expect(event?.request?.url ?? '').not.toContain('returnTo')
  })

  it('R5 the same failure twice on one Sentry client sends two events, each with its reference', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const envelopes = spySentry()

    const first = await failWith('/api/x')
    const second = await failWith('/api/x', { freshClient: false })
    const references = [
      (await first.json<{ reference: string }>()).reference,
      (await second.json<{ reference: string }>()).reference,
    ]

    await vi.waitFor(() => expect(sentryEvents(envelopes)).toHaveLength(2))
    expect(sentryEvents(envelopes).map((event) => event.tags?.reference)).toEqual(references)
  })

  it('R5 a cf-ray that is not in the shape of Cloudflare is logged as null', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    spySentry()

    await failWith('/api/x', { headers: { 'CF-Ray': '"}{"companyId":"x' } })

    expect(failureLogs(error)).toEqual([
      {
        reference: expect.stringMatching(ERROR_REFERENCE),
        cfRay: null,
        code: 'api.unexpected',
        companyId: null,
      },
    ])
  })

  it('R5 inside a company the log carries its id, never its slug', async () => {
    const owner = await newSession()
    const slug = await createCompany(owner)
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    spySentry()

    const response = await failWith(`/api/t/${slug}/x`, {
      headers: { Cookie: `__Host-session=${owner}` },
    })

    expect(response.status).toBe(500)
    expect(failureLogs(error)).toEqual([
      {
        reference: expect.stringMatching(ERROR_REFERENCE),
        cfRay: null,
        code: 'api.unexpected',
        companyId: expect.any(String),
      },
    ])
    expect(JSON.stringify(error.mock.calls)).not.toContain(slug)
  })

  it('decision 2: a 4xx never carries a reference', async () => {
    const responses = [
      await me(undefined),
      await exports.default.fetch(`${ORIGIN}/api/nothing-here`),
    ]

    expect(responses.map((response) => response.status)).toEqual([401, 404])
    for (const response of responses) {
      expect(await response.json()).not.toHaveProperty('reference')
    }
  })

  it('R2 no route takes a reference as a parameter', () => {
    const params = app.routes.flatMap((route) => route.path.match(/:[A-Za-z]+/g) ?? [])

    expect(params.filter((param) => /ref|error/i.test(param))).toEqual([])
  })
})

// Ticket 95: the version headers and the client version in Sentry (ADR-0059). Made-up hashes and
// dates (ADR-0043).
const OWN_VERSION = 'a1b2c3d4e5f6'
const BUILD_DATE = '2026-01-01T00:00:00Z'
const LATER = '2100-01-01T00:00:00Z'

// Variables the generated Env does not declare yet; spread, so the extra keys typecheck.
const withVars = (vars: Record<string, string>) => ({ ...env, ...vars }) as typeof env

describe('the version headers', () => {
  it('E1 E6 every answer carries X-App-Version, and X-Min-Client-Version when the minimum is not later than the build', async () => {
    for (const minimum of ['2025-12-31T23:59:59Z', BUILD_DATE]) {
      const bindings = withVars({
        APP_VERSION: OWN_VERSION,
        APP_BUILD_DATE: BUILD_DATE,
        MIN_CLIENT_VERSION: minimum,
      })

      for (const path of ['/health', '/api/me']) {
        const response = await app.request(`${ORIGIN}${path}`, {}, bindings)

        expect(response.headers.get('X-App-Version'), path).toBe(OWN_VERSION)
        expect(response.headers.get('X-Min-Client-Version'), path).toBe(minimum)
      }
    }
  })

  it('R6 a minimum later than the served build sends no X-Min-Client-Version and logs it without the value', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const bindings = withVars({
      APP_VERSION: OWN_VERSION,
      APP_BUILD_DATE: BUILD_DATE,
      MIN_CLIENT_VERSION: LATER,
    })

    const response = await app.request(`${ORIGIN}/health`, {}, bindings)

    expect(response.status).toBe(200)
    expect(response.headers.get('X-App-Version')).toBe(OWN_VERSION)
    expect(response.headers.has('X-Min-Client-Version')).toBe(false)
    const logs = error.mock.calls.map(([line]) =>
      typeof line === 'string' ? parseLine(line) : null,
    )
    expect(logs).toContainEqual({ event: 'min_client_version_after_build' })
    expect(JSON.stringify(error.mock.calls)).not.toContain('2100')
  })

  it('R6 without the build date or the minimum there is no X-Min-Client-Version', async () => {
    const complete = await app.request(
      `${ORIGIN}/health`,
      {},
      withVars({ APP_BUILD_DATE: BUILD_DATE, MIN_CLIENT_VERSION: BUILD_DATE }),
    )
    const noBuildDate = await app.request(
      `${ORIGIN}/health`,
      {},
      withVars({ MIN_CLIENT_VERSION: BUILD_DATE }),
    )
    const noMinimum = await app.request(
      `${ORIGIN}/health`,
      {},
      withVars({ APP_BUILD_DATE: BUILD_DATE }),
    )

    expect(complete.headers.get('X-Min-Client-Version')).toBe(BUILD_DATE)
    expect(noBuildDate.headers.has('X-Min-Client-Version')).toBe(false)
    expect(noMinimum.headers.has('X-Min-Client-Version')).toBe(false)
  })

  it('R6 R11 parseEnv keeps valid version variables and refuses invalid ones', () => {
    expect(
      parseEnv(
        withVars({
          APP_VERSION: OWN_VERSION,
          APP_BUILD_DATE: BUILD_DATE,
          MIN_CLIENT_VERSION: LATER,
        }),
      ),
    ).toMatchObject({
      APP_VERSION: OWN_VERSION,
      APP_BUILD_DATE: BUILD_DATE,
      MIN_CLIENT_VERSION: LATER,
    })

    for (const vars of [
      { APP_VERSION: 'a b' },
      { APP_VERSION: 'x'.repeat(65) },
      { APP_BUILD_DATE: 'tomorrow' },
      { APP_BUILD_DATE: '2026-13-40T00:00:00Z' },
      { MIN_CLIENT_VERSION: '2026-01-01T00:00:00+01:00' },
      { MIN_CLIENT_VERSION: '2026-01-01T00:00:00.000Z' },
      { MIN_CLIENT_VERSION: '<b>' },
    ])
      expect(() => parseEnv(withVars(vars)), JSON.stringify(vars)).toThrow()
  })
})

describe('the client version in Sentry', () => {
  afterAll(() => {
    Reflect.deleteProperty(globalThis, '__SENTRY_CLOUDFLARE_CLIENT__')
  })

  it('R1 an event carries the clientVersion tag when the header is a build hash or version', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const envelopes = spySentry()
    const version = 'a'.repeat(64)

    const response = await failWith('/api/x', { headers: { 'X-Client-Version': version } })

    expect(response.status).toBe(500)
    await vi.waitFor(() => expect(sentryEvents(envelopes)).toHaveLength(1))
    expect(sentryEvents(envelopes)[0]?.tags?.clientVersion).toBe(version)
  })

  it('R1 free text, quotes and 65 characters never reach Sentry as a tag', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const envelopes = spySentry()
    const refused = ['a b', 'v1"}', 'x'.repeat(65)]

    for (const version of refused)
      await failWith('/api/x', { headers: { 'X-Client-Version': version } })
    await failWith('/api/x', { headers: { 'X-Client-Version': OWN_VERSION } })

    await vi.waitFor(() => expect(sentryEvents(envelopes)).toHaveLength(refused.length + 1))
    const tags = sentryEvents(envelopes).map((event) => event.tags?.clientVersion)
    expect(tags).toEqual([undefined, undefined, undefined, OWN_VERSION])
    expect(envelopes.join('\n')).not.toContain('x'.repeat(65))
  })
})
