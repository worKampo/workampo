import type { IdentityProvider } from '../../_shared/auth/identity-provider'

const GOOGLE_CALLBACK_PATH = '/api/sessions/google/callback'

// A Workers extension of SubtleCrypto; spelled out so the web, which type-checks this file for hc
// with the DOM types, accepts it too.
const workersSubtle = crypto.subtle as SubtleCrypto & {
  timingSafeEqual(a: ArrayBufferView, b: ArrayBufferView): boolean
}

// The state ties Google's answer to this browser: it goes to Google and into a cookie.
export function startGoogleSignIn({
  provider,
  origin,
}: {
  provider: IdentityProvider
  origin: string
}) {
  const state = newState()
  const url = provider.googleAuthorizationUrl({
    state,
    redirectUri: `${origin}${GOOGLE_CALLBACK_PATH}`,
  })

  return { state, url }
}

// Constant time, so the comparison leaks nothing about the expected state.
export function isSameState(expected: string | undefined, received: string | undefined) {
  if (!expected || !received) return false

  const encoder = new TextEncoder()
  const [a, b] = [encoder.encode(expected), encoder.encode(received)]
  if (a.byteLength !== b.byteLength) return false

  return workersSubtle.timingSafeEqual(a, b)
}

function newState() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))

  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}
