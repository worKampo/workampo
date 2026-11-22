import { zValidator } from '@hono/zod-validator'
import {
  startCodeSignInSchema,
  verifyCodeSchema,
} from '@workampo/domain/access/sign-in/sign-in-code'
import { resolveLanguage } from '@workampo/i18n/resolve-language'
import { type Context, Hono } from 'hono'
import { identityProvider } from '../../_shared/auth/provider-registry'
import { readSessionCookie, setSessionCookie } from '../../_shared/auth/session-cookie'
import { parseEnv } from '../../_shared/env'
import type { AppEnv } from '../../_shared/http/app-env'
import { problemJson, toProblem } from '../../_shared/http/problem-json'
import { hitRateLimit } from '../../_shared/rate-limit/rate-limit'
import { completeSignIn } from './complete-sign-in'
import { startCodeSignIn } from './start-code-sign-in'

export const signInRoutes = new Hono<AppEnv>()
  .post(
    '/sign-in-codes',
    zValidator('json', startCodeSignInSchema, (result) => {
      if (!result.success) return problemJson('access.invalid_email')
    }),
    (c) =>
      answer(async () => {
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
            ...origin(c),
          },
        })

        return c.body(null, 202)
      }),
  )
  .post(
    '/sessions',
    zValidator('json', verifyCodeSchema, (result) => {
      if (result.success) return

      const isEmailWrong = result.error.issues.some((issue) => issue.path[0] === 'email')

      return problemJson(isEmailWrong ? 'access.invalid_email' : 'access.invalid_code')
    }),
    (c) =>
      answer(async () => {
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
        if (isOverLimit) return problemJson('access.too_many_attempts')

        const identity = await identityProvider(env).completeCodeSignIn({
          email,
          code,
          ...origin(c),
        })
        const { user, sessionToken } = await completeSignIn(c.env, {
          identity,
          previousSessionToken: readSessionCookie(c),
        })
        setSessionCookie(c, sessionToken)

        return c.json({ user }, 201)
      }),
  )

// Cloudflare always sets CF-Connecting-IP; only local tools may lack it.
function origin(c: Context) {
  return {
    ipAddress: c.req.header('CF-Connecting-IP') ?? 'unknown',
    userAgent: c.req.header('User-Agent'),
  }
}

async function answer(handle: () => Promise<Response>) {
  try {
    return await handle()
  } catch (error) {
    const problem = toProblem(error)
    if (!problem) throw error

    return problem
  }
}
