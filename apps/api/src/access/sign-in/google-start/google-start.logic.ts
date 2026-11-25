import { safeReturnTo } from '@workampo/domain/access/sign-in/return-to'
import { randomToken } from '../../../_shared/crypto/random-token'
import type { IdentityProvider } from '../../../_shared/identity/identity-provider'

const GOOGLE_CALLBACK_PATH = '/api/sessions/google/callback'

// A Workers extension of SubtleCrypto; spelled out so the web, which type-checks this file for hc
// with the DOM types, accepts it too.
const workersSubtle = crypto.subtle as SubtleCrypto & {
  timingSafeEqual(a: ArrayBufferView, b: ArrayBufferView): boolean
}

// The state ties Google's answer to this browser: it goes to Google and into a cookie. returnTo
// goes only into the cookie; an unsafe one is dropped, never refused.
export function startGoogleSignIn({
  provider,
  origin,
  returnTo,
}: {
  provider: IdentityProvider
  origin: string
  returnTo?: unknown
}) {
  const state = randomToken()
  const url = provider.googleAuthorizationUrl({
    state,
    redirectUri: `${origin}${GOOGLE_CALLBACK_PATH}`,
  })

  return { state, url, returnTo: safeReturnTo(returnTo) }
}

// Constant time, so the comparison leaks nothing about the expected state.
export function isSameState(expected: string | undefined, received: string | undefined) {
  if (!expected || !received) return false

  const encoder = new TextEncoder()
  const [a, b] = [encoder.encode(expected), encoder.encode(received)]
  if (a.byteLength !== b.byteLength) return false

  return workersSubtle.timingSafeEqual(a, b)
}
