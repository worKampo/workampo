import type { IdentityProvider } from '../../_shared/auth/identity-provider'
import { InvalidCodeError } from '../../_shared/auth/identity-provider'
import type { RequestOrigin } from '../../_shared/http/request-origin'
import { hitRateLimit } from '../../_shared/rate-limit/rate-limit'
import { AccessError } from '../errors'
import { completeSignIn } from './complete-sign-in'

type Limits = { perEmail: number; windowSeconds: number }

// The code arm of sign-in, symmetric with Google's: limit, verify with the provider, sign in.
export async function completeCodeSignIn(
  env: { DB_GLOBAL: D1Database },
  {
    provider,
    limits,
    email,
    code,
    origin,
    previousSessionToken,
  }: {
    provider: IdentityProvider
    limits: Limits
    email: string
    code: string
    origin: RequestOrigin
    previousSessionToken: string | undefined
  },
) {
  // Every attempt counts, right or wrong, before the provider is asked (@id:access-96-4).
  const isOverLimit = await hitRateLimit(env, {
    purpose: 'code_attempt',
    subjectKind: 'email',
    subject: email,
    threshold: limits.perEmail,
    windowSeconds: limits.windowSeconds,
    now: new Date(),
  })
  if (isOverLimit) throw new AccessError('access.too_many_attempts')

  const identity = await provider
    .completeCodeSignIn({ email, code, ...origin })
    .catch((error: unknown) => {
      if (error instanceof InvalidCodeError)
        throw new AccessError('access.invalid_code', { cause: error })

      throw error
    })

  return completeSignIn(env, { identity, previousSessionToken })
}
