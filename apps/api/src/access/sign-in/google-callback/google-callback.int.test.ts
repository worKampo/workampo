import { exports } from 'cloudflare:workers'
import { expect, it } from 'vitest'
import { me, sessionCookie } from '../../../_shared/testing/api-requests'

it('@id:access-96-6 Google start redirects to the provider with a state cookie', async () => {
  const { response, state, location } = await startGoogle()

  expect(response.status).toBe(302)
  expect(state).toBeDefined()
  expect(new URL(location).searchParams.get('state')).toBe(state)
})

it('@id:access-96-6 the callback with that state signs in and goes to /', async () => {
  const { state, location } = await startGoogle()

  const back = await callback({ url: await throughConsent(location), stateCookie: state })

  expect(back.status).toBe(302)
  expect(new URL(back.headers.get('Location') ?? '', 'https://app.test').pathname).toBe('/')
  expect(await (await me(sessionCookie(back))).json()).toMatchObject({
    email: 'google@example.com',
  })
})

it('@id:access-96-7 a state that does not match the cookie creates no session', async () => {
  const { state, location } = await startGoogle()
  const forged = new URL(location)
  forged.searchParams.set('state', 'forged')

  const answers = [
    await callback({ url: await throughConsent(forged.href), stateCookie: state }),
    await callback({ url: await throughConsent(location) }),
  ]

  for (const back of answers) {
    const target = new URL(back.headers.get('Location') ?? '', 'https://app.test')
    expect(back.status).toBe(302)
    expect(`${target.pathname}${target.search}`).toBe('/login?error=access.invalid_state')
    expect(sessionCookie(back)).toBeUndefined()
  }
})

it('@id:access-96-8 a linked identity signs in to the same account with Google', async () => {
  const first = await me(sessionCookie(await signInWithGoogle()))

  const second = await me(sessionCookie(await signInWithGoogle()))

  const firstUser = await first.json<{ id: string; email: string }>()
  expect(firstUser.email).toBe('google@example.com')
  expect((await second.json<{ id: string }>()).id).toBe(firstUser.id)
})

const SETTINGS = '/c/northwind/settings'
const withReturnTo = (returnTo: string) => `?returnTo=${encodeURIComponent(returnTo)}`
const pathOf = (response: Response) => {
  const url = new URL(response.headers.get('Location') ?? '', 'https://app.test')
  // A tampered returnTo must stay in the app, not only end on the expected path.
  expect(url.origin).toBe('https://app.test')
  return `${url.pathname}${url.search}`
}
// The state Google carries back, which the start also put in the URL it redirected to.
const providerState = (location: string) => new URL(location).searchParams.get('state') ?? ''

it('@id:access-91-2 the callback comes back to the returnTo the start kept', async () => {
  const { state, location } = await startGoogle(withReturnTo(SETTINGS))

  const back = await callback({ url: await throughConsent(location), stateCookie: state })

  expect(back.status).toBe(302)
  expect(pathOf(back)).toBe(SETTINGS)
  expect(await (await me(sessionCookie(back))).json()).toMatchObject({
    email: 'google@example.com',
  })
})

it('@id:access-91-2 the returnTo travels in the state cookie, never to Google', async () => {
  const { response, state, location } = await startGoogle(withReturnTo(SETTINGS))
  const setCookie = response.headers.get('Set-Cookie') ?? ''

  expect(location).not.toContain('northwind')
  // The cookie is `<state>.<returnTo>`; the state is base64url, so it never holds a dot.
  expect(decodeURIComponent(state ?? '')).toBe(`${providerState(location)}.${SETTINGS}`)
  for (const attribute of [/HttpOnly/i, /Secure/i, /SameSite=Lax/i, /Path=\//i, /Max-Age=600/i])
    expect(setCookie).toMatch(attribute)
  expect(setCookie).not.toMatch(/Domain=/i)
})

it('@id:access-91-1 a query in the returnTo comes back whole', async () => {
  const members = '/c/northwind/members?page=2'
  const { state, location } = await startGoogle(withReturnTo(members))

  const back = await callback({ url: await throughConsent(location), stateCookie: state })

  expect(pathOf(back)).toBe(members)
})

for (const tampered of [
  'https://evil.test',
  '//evil.test',
  '/\\evil.test',
  '/\t/evil.test',
  '/login',
  '/api/me',
])
  it(`@id:access-91-3 a cookie tampered to return to ${JSON.stringify(tampered)} signs in and comes back to /`, async () => {
    const { location } = await startGoogle()
    const state = providerState(location)

    const back = await callback({
      url: await throughConsent(location),
      stateCookie: `${state}.${encodeURIComponent(tampered)}`,
    })

    expect(back.status).toBe(302)
    expect(pathOf(back)).toBe('/')
    expect(sessionCookie(back)).toBeDefined()
  })

it('@id:access-91-3 an unsafe returnTo is dropped at the start: a bare state cookie and back to /', async () => {
  const { response, state, location } = await startGoogle(withReturnTo('https://evil.test'))

  const back = await callback({ url: await throughConsent(location), stateCookie: state })

  expect(response.status).toBe(302)
  expect(state).toBe(providerState(location))
  expect(pathOf(back)).toBe('/')
})

it('@id:access-91-3 a returnTo too long for the cookie once encoded is dropped: a bare state cookie and back to /', async () => {
  // 1024 characters, the longest safe returnTo, but 9 bytes each once URL-encoded.
  const { response, state, location } = await startGoogle(withReturnTo(`/${'中'.repeat(1023)}`))

  const back = await callback({ url: await throughConsent(location), stateCookie: state })

  expect(response.status).toBe(302)
  expect(state).toBe(providerState(location))
  expect(pathOf(back)).toBe('/')
})

it('@id:access-91-3 a state my browser did not generate gives invalid_state, never the returnTo', async () => {
  const { state, location } = await startGoogle(withReturnTo(SETTINGS))
  const forged = new URL(location)
  forged.searchParams.set('state', 'forged')

  const back = await callback({ url: await throughConsent(forged.href), stateCookie: state })

  expect(back.status).toBe(302)
  expect(pathOf(back)).toBe('/login?error=access.invalid_state')
  expect(sessionCookie(back)).toBeUndefined()
})

async function startGoogle(query = '') {
  const response = await exports.default.fetch(`https://app.test/api/sessions/google${query}`, {
    redirect: 'manual',
  })
  const state = /__Host-oauth_state=([^;]+)/.exec(response.headers.get('Set-Cookie') ?? '')?.[1]

  return { response, state, location: response.headers.get('Location') ?? '' }
}

function callback({ url, stateCookie }: { url: string; stateCookie?: string | undefined }) {
  return exports.default.fetch(url, {
    redirect: 'manual',
    headers: stateCookie ? { Cookie: `__Host-oauth_state=${stateCookie}` } : {},
  })
}

async function signInWithGoogle() {
  const { state, location } = await startGoogle()

  return callback({ url: await throughConsent(location), stateCookie: state })
}

// The fake's authorization URL is its consent page, which sends the browser on to our callback.
async function throughConsent(url: string) {
  const page = await (await exports.default.fetch(url)).text()
  const next = /url=([^"]+)"/.exec(page)?.[1]
  if (!next) throw new Error('the consent page names no callback')

  return next.replaceAll('&amp;', '&')
}
