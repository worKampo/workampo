import { zValidator } from '@hono/zod-validator'
import { startCodeSignInSchema } from '@workampo/domain/access/sign-in/sign-in-code'
import { resolveLanguage } from '@workampo/i18n/resolve-language'
import { Hono } from 'hono'
import type { AppEnv } from '../../../_shared/http/app-env'
import { requestOrigin } from '../../../_shared/http/request-origin'
import { identityProvider } from '../../../_shared/identity/provider-registry'
import { AccessError } from '../../errors'
import { startCodeSignIn } from './start-code-sign-in'

export const startCodeRoute = new Hono<AppEnv>().post(
  '/sign-in-codes',
  zValidator('json', startCodeSignInSchema, (result) => {
    if (!result.success) throw new AccessError('access.invalid_email')
  }),
  async (c) => {
    const { env } = c.var

    await startCodeSignIn(c.env, {
      provider: identityProvider(env),
      limits: {
        perEmail: env.RATE_LIMIT_CODE_REQUESTS_PER_EMAIL,
        perIp: env.RATE_LIMIT_CODE_REQUESTS_PER_IP,
        windowSeconds: env.RATE_LIMIT_WINDOW_SECONDS,
      },
      request: {
        email: c.req.valid('json').email,
        locale: resolveLanguage(c.req.header('Accept-Language')),
        ...requestOrigin(c),
      },
    })

    return c.body(null, 202)
  },
)
