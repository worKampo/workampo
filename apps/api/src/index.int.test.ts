import { exports } from 'cloudflare:workers'
import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.restoreAllMocks()
})

it('answers /health with status, sha and version', async () => {
  const response = await exports.default.fetch('https://app.test/health')

  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({
    status: 'ok',
    sha: 'local',
    version: expect.any(String),
  })
})

it('does not set X-App-Version without APP_VERSION', async () => {
  const response = await exports.default.fetch('https://app.test/health')

  expect(response.headers.has('X-App-Version')).toBe(false)
})

it('logs only the client version, method and path', async () => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})

  await exports.default.fetch('https://app.test/health?token=secret', {
    headers: { 'X-Client-Version': 'abc123', 'X-Other': 'nope' },
  })

  expect(log).toHaveBeenCalledTimes(1)
  expect(JSON.parse(log.mock.calls[0]?.[0] as string)).toEqual({
    clientVersion: 'abc123',
    method: 'GET',
    path: '/health',
  })
})

it('logs nothing without X-Client-Version', async () => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})

  await exports.default.fetch('https://app.test/health')

  expect(log).not.toHaveBeenCalled()
})
