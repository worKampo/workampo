import { cleanup, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { problem, renderApp } from '../testing/render-app'
import { watchedFetch } from './watched-fetch'

// Made-up hashes (ADR-0043).
const OWN = 'a1b2c3d4e5f6'
const NEW = '9f8e7d6c5b4a'

afterEach(cleanup)

describe('watchedFetch', () => {
  it('E1 E6 every answer is observed, a 4xx and a 5xx too, and returned as it came', async () => {
    const watch = { observe: vi.fn() }

    for (const status of [200, 401, 404, 500]) {
      const answer = new Response('{}', { status, headers: { 'X-App-Version': NEW } })
      const fetch = watchedFetch(async () => answer, watch)

      const response = await fetch('https://app.test/api/me')

      expect(response, String(status)).toBe(answer)
      expect(watch.observe).toHaveBeenLastCalledWith(answer.headers)
    }
    expect(watch.observe).toHaveBeenCalledTimes(4)
  })

  it('passes the request on as it was made', async () => {
    const inner = vi.fn(async () => new Response('{}'))
    const init = { method: 'POST', body: '{}' }

    await watchedFetch(inner, { observe: () => {} })('https://app.test/api/companies', init)

    expect(inner).toHaveBeenCalledWith('https://app.test/api/companies', init)
  })

  it('a fetch that fails rethrows the same error and observes nothing', async () => {
    const watch = { observe: vi.fn() }
    const offline = new TypeError('Failed to fetch')

    const call = watchedFetch(async () => Promise.reject(offline), watch)('https://app.test/api/me')

    await expect(call).rejects.toBe(offline)
    expect(watch.observe).not.toHaveBeenCalled()
  })
})

describe('the API client of the app', () => {
  it('E7 every call carries the version of my build in X-Client-Version', async () => {
    const sent: (string | null)[] = []

    renderApp({
      path: '/login',
      version: OWN,
      answer: (request) => {
        sent.push(request.headers.get('X-Client-Version'))
        return problem({ status: 401, code: 'access.unauthenticated' })
      },
    })

    await waitFor(() => expect(sent.length).toBeGreaterThan(0))
    expect(new Set(sent)).toEqual(new Set([OWN]))
  })
})
