import { env, exports } from 'cloudflare:workers'
import { afterEach, expect, it, vi } from 'vitest'
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
