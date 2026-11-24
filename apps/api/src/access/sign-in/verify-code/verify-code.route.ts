import { zValidator } from '@hono/zod-validator'
import { verifyCodeSchema } from '@workampo/domain/access/sign-in/sign-in-code'
import { Hono } from 'hono'
import type { AppEnv } from '../../../_shared/http/app-env'
import { requestOrigin } from '../../../_shared/http/cloudflare-request-origin'
import { identityProvider } from '../../../_shared/identity/provider-registry'
import { AccessError } from '../../errors'
import { readSessionCookie, setSessionCookie } from '../../session/session.cookie'
import { completeCodeSignIn } from './verify-code.logic'

export const verifyCodeRoute = new Hono<AppEnv>().post(
  '/sessions',
  zValidator('json', verifyCodeSchema, (result) => {
    if (result.success) return

    const isEmailWrong = result.error.issues.some((issue) => issue.path[0] === 'email')
    throw new AccessError(isEmailWrong ? 'access.invalid_email' : 'access.invalid_code')
  }),
  async (c) => {
    const { env } = c.var

    const { user, sessionToken } = await completeCodeSignIn(c.env, {
      provider: identityProvider(env),
      limits: {
        perEmail: env.RATE_LIMIT_CODE_ATTEMPTS_PER_EMAIL,
        windowSeconds: env.RATE_LIMIT_WINDOW_SECONDS,
      },
      ...c.req.valid('json'),
      origin: requestOrigin(c),
      previousSessionToken: readSessionCookie(c),
    })
    setSessionCookie(c, sessionToken)

    return c.json({ user }, 201)
  },
)
