import { exports } from 'cloudflare:workers'
import { expect, it } from 'vitest'
import { me, sessionCookie } from '../../_shared/testing/api-requests'

it('@id:access-96-6 Google start redirects to the provider with a state cookie', async () => {
  const { response, state, location } = await startGoogle()

  expect(response.status).toBe(302)
  expect(state).toBeDefined()
  expect(new URL(location).searchParams.get('state')).toBe(state)
})

it('@id:access-96-6 the callback with that state signs in and goes to /', async () => {
  const { state, location } = await startGoogle()

  const back = await callback({ url: location, stateCookie: state })

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
    await callback({ url: forged.href, stateCookie: state }),
    await callback({ url: location }),
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

// The fake's authorization URL points straight back to our callback.
async function startGoogle() {
  const response = await exports.default.fetch('https://app.test/api/sessions/google', {
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

  return callback({ url: location, stateCookie: state })
}
