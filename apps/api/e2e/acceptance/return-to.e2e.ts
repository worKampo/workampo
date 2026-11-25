import { type APIRequestContext, expect, request, test } from '@playwright/test'
import { SESSION_COOKIE } from '../../../../e2e/support/acceptance-support'

// The fake provider's consent page stands in for Google (apps/api/src/_shared/identity/fake-consent.ts).
const SETTINGS = '/c/northwind/settings'

type Answer = { status: number; location: string }

const answerOf = async (response: {
  status(): number
  headers(): Record<string, string>
}): Promise<Answer> => ({ status: response.status(), location: response.headers().location ?? '' })

// Start → consent → callback, one hop at a time, with the browser's cookies kept by the context.
async function googleRoundTrip(api: APIRequestContext, startQuery = '') {
  const start = await answerOf(
    await api.get(`/api/sessions/google${startQuery}`, { maxRedirects: 0 }),
  )
  expect(start.status).toBe(302)
  const consent = await (await api.get(start.location)).text()
  const callback = /url=([^"]+)"/.exec(consent)?.[1]?.replaceAll('&amp;', '&')
  if (!callback) throw new Error('the consent page names no callback')
  const back = await answerOf(await api.get(callback, { maxRedirects: 0 }))

  return { start, back }
}

const pathOf = (location: string) => {
  const url = new URL(location, 'https://app.test')
  // A tampered returnTo must stay in the app, not only end on the expected path.
  expect(url.origin).toBe('https://app.test')
  return `${url.pathname}${url.search}`
}

async function hasSession(api: APIRequestContext) {
  const { cookies } = await api.storageState()
  return cookies.some((cookie) => cookie.name === SESSION_COOKIE)
}

const newContext = () => request.newContext({ ...baseUrl(), ignoreHTTPSErrors: true })

test('@id:access-91-2 Google comes back to the page I opened, which never goes to Google', async () => {
  const api = await newContext()

  const { start, back } = await googleRoundTrip(api, `?returnTo=${encodeURIComponent(SETTINGS)}`)

  expect(start.location).not.toContain('northwind')
  expect(back.status).toBe(302)
  expect(pathOf(back.location)).toBe(SETTINGS)
  expect(await hasSession(api)).toBe(true)
})

for (const returnTo of [
  'https://otro-sitio.example.com',
  '//otro-sitio.example.com',
  '/\\otro-sitio.example.com',
  '/login',
  '/api/me',
]) {
  test(`@id:access-91-3 Google ignores the way back "${returnTo}" and comes back to /`, async () => {
    const api = await newContext()

    const { start, back } = await googleRoundTrip(api, `?returnTo=${encodeURIComponent(returnTo)}`)

    // An invalid way back is dropped, never refused.
    expect(start.status).toBe(302)
    expect(back.status).toBe(302)
    expect(pathOf(back.location)).toBe('/')
    expect(await hasSession(api)).toBe(true)
  })
}

// The project's baseURL, for contexts made by hand, which do not inherit it.
function baseUrl() {
  const { baseURL } = test.info().project.use
  return baseURL ? { baseURL } : {}
}
