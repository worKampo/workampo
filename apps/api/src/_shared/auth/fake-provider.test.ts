import { describe, expect, it } from 'vitest'
import { FAKE_EXPIRED_CODE, FAKE_GOOGLE_CODE, FAKE_VALID_CODE } from './fake-identities'
import { fakeProvider } from './fake-provider'
import { InvalidCodeError } from './identity-provider'
import { identityProviderContract } from './identity-provider.contract'

identityProviderContract({
  name: 'the fake',
  makeProvider: () => fakeProvider,
  email: 'ana@example.com',
  validCode: FAKE_VALID_CODE,
  invalidCode: '111111',
})

describe('the fake identities that tests and the seed rely on', () => {
  it.each([
    { typed: 'ana@example.com', subject: 'fake|ana@example.com', email: 'ana@example.com' },
    { typed: 'linked@example.com', subject: 'fake|linked', email: 'linked@example.com' },
    {
      typed: 'unverified@example.com',
      subject: 'fake|unverified',
      email: 'unverified@example.com',
      isEmailVerified: false,
    },
    { typed: 'taken@example.com', subject: 'fake|taken@example.com', email: 'taken@example.com' },
    { typed: 'renamed@example.com', subject: 'fake|renamed', email: 'renamed.new@example.com' },
    { typed: 'clash@example.com', subject: 'fake|clash', email: 'linked@example.com' },
  ])('$typed signs in as $subject', async ({ typed, subject, email, isEmailVerified = true }) => {
    const identity = await signIn(typed)

    expect(identity).toEqual({ provider: 'workos', subject, email, isEmailVerified })
  })

  it('the expired code is invalid like a wrong one', async () => {
    await expect(
      fakeProvider.completeCodeSignIn({ email: 'ana@example.com', code: FAKE_EXPIRED_CODE }),
    ).rejects.toBeInstanceOf(InvalidCodeError)
  })

  it('Google comes straight back to our callback and signs in as the Google user', async () => {
    const url = new URL(
      fakeProvider.googleAuthorizationUrl({
        state: 'state 1',
        redirectUri: 'https://app.test/api/sessions/google/callback',
      }),
    )
    expect(url.origin + url.pathname).toBe('https://app.test/api/sessions/google/callback')
    expect(url.searchParams.get('code')).toBe(FAKE_GOOGLE_CODE)
    expect(url.searchParams.get('state')).toBe('state 1')
    expect(await fakeProvider.completeGoogleSignIn({ code: FAKE_GOOGLE_CODE })).toEqual({
      provider: 'workos',
      subject: 'fake|google',
      email: 'google@example.com',
      isEmailVerified: true,
    })
    await expect(fakeProvider.completeGoogleSignIn({ code: 'other' })).rejects.toBeInstanceOf(
      InvalidCodeError,
    )
  })
})

const signIn = (email: string) => fakeProvider.completeCodeSignIn({ email, code: FAKE_VALID_CODE })
