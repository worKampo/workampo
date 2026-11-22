import { exports } from 'cloudflare:workers'
import { expect, it } from 'vitest'

const STATE_COOKIE = /__Host-oauth_state=([^;]+)/

it('@id:access-96-6 Google start redirects with a state cookie and the callback signs in', async () => {
  const { response, state, location } = await startGoogle()

  expect(response.status).toBe(302)
  expect(state).toBeDefined()
  expect(new URL(location).searchParams.get('state')).toBe(state)

  const back = await callback(location, state)

  expect(back.status).toBe(302)
  expect(new URL(back.headers.get('Location') ?? '', 'https://app.test').pathname).toBe('/')
  expect(await me(sessionCookie(back))).toMatchObject({ email: 'google@example.com' })
})

it('@id:access-96-7 a state that does not match the cookie creates no session', async () => {
  const { state, location } = await startGoogle()
  const forged = new URL(location)
  forged.searchParams.set('state', 'forged')

  for (const back of [await callback(forged.href, state), await callback(location)]) {
    expect(back.status).toBe(302)
    const target = new URL(back.headers.get('Location') ?? '', 'https://app.test')
    expect(`${target.pathname}${target.search}`).toBe('/login?error=access.invalid_state')
    expect(sessionCookie(back)).toBeUndefined()
  }
})

it('@id:access-96-8 a linked identity signs in to the same account with Google', async () => {
  const first = await me(sessionCookie(await signInWithGoogle()))
  const second = await me(sessionCookie(await signInWithGoogle()))

  expect(first.email).toBe('google@example.com')
  expect(second.id).toBe(first.id)
})

/** Starts Google sign-in; the fake's authorization URL points back to our callback. */
async function startGoogle() {
  const response = await exports.default.fetch('https://app.test/api/sessions/google', {
    redirect: 'manual',
  })
  const state = STATE_COOKIE.exec(response.headers.get('Set-Cookie') ?? '')?.[1]

  return { response, state, location: response.headers.get('Location') ?? '' }
}

function callback(url: string, cookie?: string) {
  return exports.default.fetch(url, {
    redirect: 'manual',
    headers: cookie ? { Cookie: `__Host-oauth_state=${cookie}` } : {},
  })
}

const sessionCookie = (response: Response) =>
  /__Host-session=([^;]+)/.exec(response.headers.get('Set-Cookie') ?? '')?.[1]

async function signInWithGoogle() {
  const { state, location } = await startGoogle()

  return callback(location, state)
}

async function me(token: string | undefined) {
  const response = await exports.default.fetch('https://app.test/api/me', {
    headers: { Cookie: `__Host-session=${token}` },
  })

  return response.json<{ id: string; email: string }>()
}
