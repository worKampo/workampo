import { Hono } from 'hono'
import type { AppEnv } from '../../../_shared/http/app-env'
import { requestOrigin } from '../../../_shared/http/request-origin'
import { identityProvider } from '../../../_shared/identity/provider-registry'
import { AccessError } from '../../errors'
import { readSessionCookie, setSessionCookie } from '../../session/session-cookie'
import { completeGoogleSignIn } from './complete-google-sign-in'
import { startGoogleSignIn } from './start-google-sign-in'
import { setStateCookie, takeStateCookie } from './state-cookie'

// The redirect to Google and its callback: one flow, so one file.
export const googleRoutes = new Hono<AppEnv>()
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
