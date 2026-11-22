import { FAKE_CONSENT_PATH } from './fake-consent'
import {
  FAKE_GOOGLE_CODE,
  FAKE_PROVIDER_MARK,
  FAKE_VALID_CODE,
  fakeCodeIdentity,
  fakeGoogleIdentity,
} from './fake-identities'
import { type IdentityProvider, InvalidCodeError } from './identity-provider'

// Local and tests only; never in the stg or prod bundle.
export const fakeProvider: IdentityProvider = {
  async startCodeSignIn() {},

  async completeCodeSignIn({ email, code }) {
    if (code !== FAKE_VALID_CODE) throw new InvalidCodeError(`${FAKE_PROVIDER_MARK}: wrong code`)
    return fakeCodeIdentity(email)
  },

  googleAuthorizationUrl({ state, redirectUri }) {
    const url = new URL(FAKE_CONSENT_PATH, redirectUri)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('code', FAKE_GOOGLE_CODE)
    url.searchParams.set('state', state)

    return url.href
  },

  async completeGoogleSignIn({ code }) {
    if (code !== FAKE_GOOGLE_CODE) throw new InvalidCodeError(`${FAKE_PROVIDER_MARK}: wrong code`)
    return fakeGoogleIdentity()
  },
}
