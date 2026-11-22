import { describe, expect, it } from 'vitest'
import { type IdentityProvider, InvalidCodeError } from './identity-provider'

// The same battery for every implementation, the fake included (ADR-0029, ADR-0071).
export function identityProviderContract(
  name: string,
  makeProvider: () => IdentityProvider,
  { email, validCode, invalidCode }: { email: string; validCode: string; invalidCode: string },
) {
  describe(`${name} meets the identity provider contract`, () => {
    it('starting a code sign-in returns nothing, so the code never reaches our API', async () => {
      expect(await makeProvider().startCodeSignIn({ email, locale: 'en' })).toBeUndefined()
    })

    it('the right code returns the identity of that email', async () => {
      const identity = await makeProvider().completeCodeSignIn({ email, code: validCode })
      expect(identity).toEqual({
        provider: 'workos',
        subject: expect.any(String),
        email,
        isEmailVerified: true,
      })
    })

    it('a wrong code is an InvalidCodeError', async () => {
      await expect(
        makeProvider().completeCodeSignIn({ email, code: invalidCode }),
      ).rejects.toBeInstanceOf(InvalidCodeError)
    })

    it('the Google authorization URL carries our state', () => {
      const url = makeProvider().googleAuthorizationUrl({
        state: 'state-123',
        redirectUri: 'https://app.test/api/sessions/google/callback',
      })
      expect(new URL(url).searchParams.get('state')).toBe('state-123')
    })
  })
}
