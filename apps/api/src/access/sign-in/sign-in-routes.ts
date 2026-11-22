import { zValidator } from '@hono/zod-validator'
import {
  startCodeSignInSchema,
  verifyCodeSchema,
} from '@workampo/domain/access/sign-in/sign-in-code'
import { resolveLanguage } from '@workampo/i18n/resolve-language'
import { Hono } from 'hono'
import { identityProvider } from '../../_shared/auth/provider-registry'
import { readSessionCookie, setSessionCookie } from '../../_shared/auth/session-cookie'
import { setStateCookie, takeStateCookie } from '../../_shared/auth/state-cookie'
import type { AppEnv } from '../../_shared/http/app-env'
import { requestOrigin } from '../../_shared/http/request-origin'
import { AccessError } from '../errors'
import { completeCodeSignIn } from './complete-code-sign-in'
import { completeGoogleSignIn } from './complete-google-sign-in'
import { startCodeSignIn } from './start-code-sign-in'
import { startGoogleSignIn } from './start-google-sign-in'

export const signInRoutes = new Hono<AppEnv>()
  .post(
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
  .post(
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
  .get('/sessions/google', (c) => {
    const provider = identityProvider(c.var.env)
    const { state, url } = startGoogleSignIn({ provider, origin: new URL(c.req.url).origin })
    setStateCookie(c, state)

    return c.redirect(url, 302)
  })
  .get('/sessions/google/callback', async (c) => {
    const expectedState = takeStateCookie(c)

    try {
      const { sessionToken } = await completeGoogleSignIn(c.env, {
        provider: identityProvider(c.var.env),
        expectedState,
        answer: c.req.query(),
        origin: requestOrigin(c),
        previousSessionToken: readSessionCookie(c),
      })
      setSessionCookie(c, sessionToken)

      return c.redirect('/', 302)
    } catch (error) {
      if (!(error instanceof AccessError)) throw error

      // Only the error code in the URL, nothing personal.
      return c.redirect(`/login?error=${error.code}`, 302)
    }
  })
