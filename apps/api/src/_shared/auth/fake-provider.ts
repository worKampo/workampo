import {
  FAKE_GOOGLE_CODE,
  FAKE_VALID_CODE,
  fakeCodeIdentity,
  fakeGoogleIdentity,
} from './fake-identities'
import { type IdentityProvider, InvalidCodeError } from './identity-provider'

// Searched for in the stg and prod bundles by scripts/build/no-fake-provider.mjs.
const MARK = 'workampo-fake-identity-provider'

// Local and tests only; never in the stg or prod bundle.
export const fakeProvider: IdentityProvider = {
  async startCodeSignIn() {},

  async completeCodeSignIn({ email, code }) {
    if (code !== FAKE_VALID_CODE) throw new InvalidCodeError(`${MARK}: wrong code`)
    return fakeCodeIdentity(email)
  },

  googleAuthorizationUrl({ state, redirectUri }) {
    const url = new URL(redirectUri)
    url.searchParams.set('code', FAKE_GOOGLE_CODE)
    url.searchParams.set('state', state)
    return url.href
  },

  async completeGoogleSignIn({ code }) {
    if (code !== FAKE_GOOGLE_CODE) throw new InvalidCodeError(`${MARK}: wrong code`)
    return fakeGoogleIdentity()
  },
}
