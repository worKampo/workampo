import { describe, expect, it } from 'vitest'
import type { IdentityProvider } from '../../../_shared/identity/identity-provider'
import { isSameState, startGoogleSignIn } from './google-start.logic'

describe('startGoogleSignIn', () => {
  it('@id:access-96-6 sends the browser to Google with a new random state and our callback', () => {
    const urls: unknown[] = []
    const provider = {
      googleAuthorizationUrl: (input: unknown) => {
        urls.push(input)
        return 'https://provider.test/authorize'
      },
    } as unknown as IdentityProvider

    const first = startGoogleSignIn({ provider, origin: 'https://app.test' })
    const second = startGoogleSignIn({ provider, origin: 'https://app.test' })

    expect(first.url).toBe('https://provider.test/authorize')
    expect(first.state).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(second.state).not.toBe(first.state)
    expect(urls[0]).toEqual({
      state: first.state,
      redirectUri: 'https://app.test/api/sessions/google/callback',
    })
  })
})

describe('isSameState', () => {
  it('@id:access-96-7 accepts only the state the browser holds', () => {
    expect(isSameState('abc', 'abc')).toBe(true)
    expect(isSameState('abc', 'abd')).toBe(false)
    expect(isSameState('abc', 'abcd')).toBe(false)
    expect(isSameState(undefined, 'abc')).toBe(false)
    expect(isSameState('abc', undefined)).toBe(false)
  })
})

// The returnTo argument arrives with the returnTo task; a non-literal path keeps typecheck green
// until then. Once it exists, call the static import above.
const GOOGLE_START: string = './google-start.logic'
type StartWithReturnTo = (input: {
  provider: IdentityProvider
  origin: string
  returnTo: unknown
}) => { state: string; url: string; returnTo: string | undefined }

function recordingProvider() {
  const inputs: unknown[] = []
  const provider = {
    googleAuthorizationUrl: (input: unknown) => {
      inputs.push(input)
      return 'https://provider.test/authorize'
    },
  } as unknown as IdentityProvider

  return { provider, inputs }
}

describe('startGoogleSignIn with a way back', () => {
  it.fails('@id:access-91-2 keeps a safe returnTo for the cookie and never sends it to Google', async () => {
    const { startGoogleSignIn: start }: { startGoogleSignIn: StartWithReturnTo } = await import(
      GOOGLE_START
    )
    const { provider, inputs } = recordingProvider()

    const started = start({
      provider,
      origin: 'https://app.test',
      returnTo: '/c/northwind/settings',
    })

    expect(started.returnTo).toBe('/c/northwind/settings')
    expect(inputs).toEqual([
      { state: started.state, redirectUri: 'https://app.test/api/sessions/google/callback' },
    ])
    expect(started.url).not.toContain('northwind')
  })

  // Passes today only because the argument is ignored; it must keep passing once it is read.
  for (const returnTo of ['https://otro-sitio.example.com', '//x', '/\\x', '/login', '/api/me', ''])
    it(`@id:access-91-3 drops the returnTo "${returnTo}" without refusing the start`, async () => {
      const { startGoogleSignIn: start }: { startGoogleSignIn: StartWithReturnTo } = await import(
        GOOGLE_START
      )
      const { provider } = recordingProvider()

      const started = start({ provider, origin: 'https://app.test', returnTo })

      expect(started).toMatchObject({ url: 'https://provider.test/authorize' })
      expect(started.state).toMatch(/^[A-Za-z0-9_-]{43}$/)
      expect(started.returnTo).toBeUndefined()
      // Kept apart from the state with a dot, the state itself must never hold one.
      expect(started.state).not.toContain('.')
    })
})
