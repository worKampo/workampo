import { describe, expect, it } from 'vitest'
import type { IdentityProvider } from '../../_shared/auth/identity-provider'
import { isSameState, startGoogleSignIn } from './start-google-sign-in'

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
