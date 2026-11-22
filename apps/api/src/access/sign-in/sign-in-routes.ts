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
import { parseEnv } from '../../_shared/env'
import type { AppEnv } from '../../_shared/http/app-env'
import { problemJson } from '../../_shared/http/problem-json'
import { requestOrigin } from '../../_shared/http/request-origin'
import { hitRateLimit } from '../../_shared/rate-limit/rate-limit'
import { AccessError } from '../errors'
import { completeGoogleSignIn } from './complete-google-sign-in'
import { completeSignIn } from './complete-sign-in'
import { startCodeSignIn } from './start-code-sign-in'
import { startGoogleSignIn } from './start-google-sign-in'

export const signInRoutes = new Hono<AppEnv>()
  .post(
    '/sign-in-codes',
    zValidator('json', startCodeSignInSchema, (result) => {
      if (!result.success) return problemJson('access.invalid_email')
    }),
    async (c) => {
      const env = parseEnv(c.env)

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

      return problemJson(isEmailWrong ? 'access.invalid_email' : 'access.invalid_code')
    }),
    async (c) => {
      const { email, code } = c.req.valid('json')
      const env = parseEnv(c.env)

      // Every attempt counts, right or wrong, before the provider is asked (plan, "Rate limiting").
      const isOverLimit = await hitRateLimit(c.env, {
        purpose: 'code_attempt',
        subjectKind: 'email',
        subject: email,
        threshold: env.RATE_LIMIT_CODE_ATTEMPTS_PER_EMAIL,
        windowSeconds: env.RATE_LIMIT_WINDOW_SECONDS,
        now: new Date(),
      })
      if (isOverLimit) throw new AccessError('access.too_many_attempts')

      const identity = await identityProvider(env).completeCodeSignIn({
        email,
        code,
        ...requestOrigin(c),
      })
      const { user, sessionToken } = await completeSignIn(c.env, {
        identity,
        previousSessionToken: readSessionCookie(c),
      })
      setSessionCookie(c, sessionToken)

      return c.json({ user }, 201)
    },
  )
  .get('/sessions/google', (c) => {
    const provider = identityProvider(parseEnv(c.env))
    const { state, url } = startGoogleSignIn({ provider, origin: new URL(c.req.url).origin })
    setStateCookie(c, state)

    return c.redirect(url, 302)
  })
  .get('/sessions/google/callback', async (c) => {
    const expectedState = takeStateCookie(c)

    try {
      const { sessionToken } = await completeGoogleSignIn(c.env, {
        provider: identityProvider(parseEnv(c.env)),
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
