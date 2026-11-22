import {
  FAKE_GOOGLE_CODE,
  FAKE_GOOGLE_IDENTITY,
  FAKE_VALID_CODE,
  fakeCodeIdentity,
} from './fake-identities'
import { type IdentityProvider, InvalidCodeError } from './identity-provider'

// Local and tests only; never in the stg or prod bundle.
export const fakeProvider: IdentityProvider = {
  async startCodeSignIn() {},

  async completeCodeSignIn({ email, code }) {
    if (code !== FAKE_VALID_CODE) throw new InvalidCodeError()
    return fakeCodeIdentity(email)
  },

  googleAuthorizationUrl({ state, redirectUri }) {
    const url = new URL(redirectUri)
    url.searchParams.set('code', FAKE_GOOGLE_CODE)
    url.searchParams.set('state', state)
    return url.href
  },

  async completeGoogleSignIn({ code }) {
    if (code !== FAKE_GOOGLE_CODE) throw new InvalidCodeError()
    return FAKE_GOOGLE_IDENTITY
  },
}
