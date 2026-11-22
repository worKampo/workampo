import type { Language } from '@workampo/i18n'
import type { IdentityProvider } from '../../_shared/auth/identity-provider'
import type { RequestOrigin } from '../../_shared/http/request-origin'
import { hitRateLimit } from '../../_shared/rate-limit/rate-limit'
import { AccessError } from '../errors'

type CodeRequest = { email: string; locale: Language } & RequestOrigin
type Limits = { perEmail: number; perIp: number; windowSeconds: number }

// Answers the same whether the account exists or not, so it cannot be used to find accounts.
export async function startCodeSignIn(
  env: { DB_GLOBAL: D1Database },
  {
    provider,
    limits,
    request,
  }: { provider: IdentityProvider; limits: Limits; request: CodeRequest },
) {
  const now = new Date()
  const window = { purpose: 'code_request' as const, windowSeconds: limits.windowSeconds, now }

  const overLimit = await Promise.all([
    hitRateLimit(env, {
      ...window,
      subjectKind: 'email',
      subject: request.email,
      threshold: limits.perEmail,
    }),
    hitRateLimit(env, {
      ...window,
      subjectKind: 'ip',
      subject: request.ipAddress,
      threshold: limits.perIp,
    }),
  ])
  if (overLimit.some(Boolean)) throw new AccessError('access.too_many_code_requests')

  await provider.startCodeSignIn(request)
}
