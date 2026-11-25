import { safeReturnTo } from '@workampo/domain/access/sign-in/return-to'
import { Hono } from 'hono'
import type { AppEnv } from '../../../_shared/http/app-env'
import { requestOrigin } from '../../../_shared/http/cloudflare-request-origin'
import { identityProvider } from '../../../_shared/identity/provider-registry'
import { AccessError } from '../../errors'
import { readSessionCookie, setSessionCookie } from '../../session/session.cookie'
import { takeStateCookie } from '../google-state.cookie'
import { completeGoogleSignIn } from './google-callback.logic'

export const googleCallbackRoute = new Hono<AppEnv>().get(
  '/sessions/google/callback',
  async (c) => {
    const { state: expectedState, returnTo } = takeStateCookie(c)

    try {
      const { sessionToken } = await completeGoogleSignIn(c.env, {
        provider: identityProvider(c.var.env),
        expectedState,
        answer: c.req.query(),
        origin: requestOrigin(c),
        previousSessionToken: readSessionCookie(c),
      })
      setSessionCookie(c, sessionToken)

      // The cookie is unsigned: returnTo counts only if it is still safe.
      return c.redirect(safeReturnTo(returnTo) ?? '/', 302)
    } catch (error) {
      if (!(error instanceof AccessError)) throw error

      // Only the error code in the URL, nothing personal.
      return c.redirect(`/login?error=${error.code}`, 302)
    }
  },
)
