import { safeReturnTo } from '@workampo/domain/access/sign-in/return-to'
import { randomToken } from '../../../_shared/crypto/random-token'
import type { IdentityProvider } from '../../../_shared/identity/identity-provider'

const GOOGLE_CALLBACK_PATH = '/api/sessions/google/callback'
// The cookie stores returnTo URL-encoded; non-ASCII triples in size and browsers drop cookies over 4 KB.
const RETURN_TO_MAX_ENCODED_LENGTH = 3000

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

  const safe = safeReturnTo(returnTo)
  const fits = safe !== undefined && encodeURIComponent(safe).length <= RETURN_TO_MAX_ENCODED_LENGTH

  return { state, url, returnTo: fits ? safe : undefined }
}

// Constant time, so the comparison leaks nothing about the expected state.
export function isSameState(expected: string | undefined, received: string | undefined) {
  if (!expected || !received) return false

  const encoder = new TextEncoder()
  const [a, b] = [encoder.encode(expected), encoder.encode(received)]
  if (a.byteLength !== b.byteLength) return false

  return workersSubtle.timingSafeEqual(a, b)
}
