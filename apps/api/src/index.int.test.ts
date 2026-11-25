import { env, exports } from 'cloudflare:workers'
import { afterEach, expect, it, vi } from 'vitest'
import { me, newEmail, newIp } from './_shared/testing/api-requests'
import { app } from './index'

afterEach(() => {
  vi.restoreAllMocks()
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

// docs/process/code-conventions.md, "API URLs and contracts" (ADR-0078).
it('every API route follows the URL rules', () => {
  const segment = /^([a-z0-9]+(-[a-z0-9]+)*|:[a-z][a-zA-Z]*)$/
  const broken = app.routes
    // Middleware such as csrf() registers wildcard paths; only endpoints name a resource.
    .filter((route) => route.method !== 'ALL' && !route.path.includes('*'))
    .map((route) => route.path)
    .filter((path) => path.startsWith('/api/'))
    .filter((path) => {
      const [first, ...rest] = path.slice('/api/'.length).replace(/\/$/, '').split('/')
      const isTenant = first === 't' && rest[0] === ':slug'
      const isCollection = first === 'me' || first?.endsWith('s')
      const opensCompanyItem = first === 'companies' && rest[0]?.startsWith(':')
      const segments = [first, ...rest]

      return (
        !segments.every((part) => part !== undefined && segment.test(part)) ||
        !(isTenant || isCollection) ||
        opensCompanyItem ||
        (!isTenant && segments.some((part) => part === ':slug'))
      )
    })

  expect(broken).toEqual([])
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
