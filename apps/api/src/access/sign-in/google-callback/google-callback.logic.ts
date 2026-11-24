import type { RequestOrigin } from '../../../_shared/http/request-origin'
import type { IdentityProvider } from '../../../_shared/identity/identity-provider'
import { AccessError } from '../../errors'
import { completeSignIn } from '../complete-sign-in.logic'
import { isSameState } from '../google-start/google-start.logic'

type GoogleAnswer = {
  code?: string | undefined
  state?: string | undefined
  error?: string | undefined
}

// Google's answer comes back through the browser: it counts only with the state this browser holds.
export async function completeGoogleSignIn(
  env: { DB_GLOBAL: D1Database },
  {
    provider,
    expectedState,
    answer,
    origin,
    previousSessionToken,
  }: {
    provider: IdentityProvider
    expectedState: string | undefined
    answer: GoogleAnswer
    origin: RequestOrigin
    previousSessionToken: string | undefined
  },
) {
  if (!isSameState(expectedState, answer.state)) throw new AccessError('access.invalid_state')
  if (answer.error || !answer.code) throw new AccessError('access.google_failed')

  const identity = await provider
    .completeGoogleSignIn({ code: answer.code, ...origin })
    .catch((cause: unknown) => {
      throw new AccessError('access.google_failed', { cause })
    })

  return completeSignIn(env, { identity, previousSessionToken })
}
