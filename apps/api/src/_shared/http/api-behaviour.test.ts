import { ERROR_REFERENCE } from '@workampo/domain/_shared/api-errors'
import { Hono } from 'hono'
import { expect, it, vi } from 'vitest'
import { apiOnError } from './api-behaviour'
import type { AppEnv } from './app-env'

it('an unexpected error outside /api keeps the plain 500', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const app = new Hono<AppEnv>()
    .get('/boom', () => {
      throw new Error('boom')
    })
    .onError(apiOnError)

  const response = await app.request('/boom')

  expect(response.status).toBe(500)
  expect(await response.text()).toBe('Internal Server Error')
})

// Ticket 93: the error reference of every unexpected failure (ADR-0078 section 6, Update).

function failingApp() {
  return new Hono<AppEnv>()
    .get('/api/boom', () => {
      throw new Error('secret a@b.test')
    })
    .get('/auth/boom', () => {
      throw new Error('secret a@b.test')
    })
    .onError(apiOnError)
}

// The failure's log lines, which are JSON so Workers logs index their fields.
function failureLogs(spy: { mock: { calls: unknown[][] } }) {
  return spy.mock.calls.flatMap(([line]) => {
    if (typeof line !== 'string') return []
    try {
      const parsed: unknown = JSON.parse(line)
      return parsed && typeof parsed === 'object' && 'reference' in parsed ? [parsed] : []
    } catch {
      return []
    }
  })
}

it('R3 the 500 under /api has exactly type, title, status, code and reference, and no detail', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})

  const response = await failingApp().request('/api/boom')
  const text = await response.text()
  const body = JSON.parse(text)

  expect(response.status).toBe(500)
  expect(Object.keys(body).sort()).toEqual(['code', 'reference', 'status', 'title', 'type'])
  expect(body).toMatchObject({
    type: 'about:blank',
    title: 'Internal Server Error',
    status: 500,
    code: 'api.unexpected',
  })
  expect(body.reference).toMatch(ERROR_REFERENCE)
  for (const leak of ['secret', 'a@b.test', '/api/boom', 'at ', 'stack', 'detail']) {
    expect(text).not.toContain(leak)
  }
  expect(error).toHaveBeenCalled()
})

it('R1 two identical failures get different references', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const app = failingApp()

  const first = await (await app.request('/api/boom')).json<{ reference: string }>()
  const second = await (await app.request('/api/boom')).json<{ reference: string }>()

  expect(first.reference).toMatch(ERROR_REFERENCE)
  expect(second.reference).toMatch(ERROR_REFERENCE)
  expect(first.reference).not.toBe(second.reference)
})

it('R6 the body and the log carry the same reference, once per failure', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})

  const body = await (await failingApp().request('/api/boom')).json<{ reference: string }>()
  const logs = failureLogs(error)

  expect(logs).toHaveLength(1)
  expect(logs[0]).toMatchObject({ reference: body.reference })
})

it('W2 a 500 outside /api stays generic text/plain, and its reference is still logged', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})

  const response = await failingApp().request('/auth/boom?returnTo=/c/northwind')
  const text = await response.text()

  expect(response.status).toBe(500)
  expect(response.headers.get('Content-Type')).toContain('text/plain')
  expect(text).toBe('Internal Server Error')
  for (const leak of ['/auth/boom', 'returnTo', 'northwind', 'secret', 'a@b.test']) {
    expect(text).not.toContain(leak)
  }
  const logs = failureLogs(error)
  expect(logs).toHaveLength(1)
  expect(logs[0]).toMatchObject({ reference: expect.stringMatching(ERROR_REFERENCE) })
})
