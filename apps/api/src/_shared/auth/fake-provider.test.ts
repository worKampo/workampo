import { describe, expect, it } from 'vitest'
import { FAKE_EXPIRED_CODE, FAKE_GOOGLE_CODE, FAKE_VALID_CODE } from './fake-identities'
import { fakeProvider } from './fake-provider'
import { InvalidCodeError } from './identity-provider'
import { identityProviderContract } from './identity-provider.contract'

identityProviderContract('the fake', () => fakeProvider, {
  email: 'ana@example.com',
  validCode: FAKE_VALID_CODE,
  invalidCode: '111111',
})

const signIn = (email: string) => fakeProvider.completeCodeSignIn({ email, code: FAKE_VALID_CODE })

describe('the fake identities that tests and the seed rely on', () => {
  it.each([
    ['ana@example.com', 'fake|ana@example.com', 'ana@example.com', true],
    ['linked@example.com', 'fake|linked', 'linked@example.com', true],
    ['unverified@example.com', 'fake|unverified', 'unverified@example.com', false],
    ['taken@example.com', 'fake|taken@example.com', 'taken@example.com', true],
    ['renamed@example.com', 'fake|renamed', 'renamed.new@example.com', true],
    ['clash@example.com', 'fake|clash', 'linked@example.com', true],
  ])('%s signs in as %s', async (email, subject, identityEmail, isEmailVerified) => {
    expect(await signIn(email)).toEqual({
      provider: 'workos',
      subject,
      email: identityEmail,
      isEmailVerified,
    })
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
