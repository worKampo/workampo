import { Hono } from 'hono'
import { expect, it, vi } from 'vitest'
import { apiOnError } from './api-behaviour'
import type { AppEnv } from './app-env'

it('an unexpected error under /api answers 500 problem+json with no detail', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const app = new Hono<AppEnv>()
    .get('/api/boom', () => {
      throw new Error('secret detail')
    })
    .onError(apiOnError)

  const response = await app.request('/api/boom')

  expect(response.status).toBe(500)
  expect(response.headers.get('Content-Type')).toContain('application/problem+json')
  expect(await response.json()).toEqual({
    type: 'about:blank',
    title: 'Internal Server Error',
    status: 500,
    code: 'api.unexpected',
  })
})

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
