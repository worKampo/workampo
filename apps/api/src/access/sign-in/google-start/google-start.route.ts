import { Hono } from 'hono'
import type { AppEnv } from '../../../_shared/http/app-env'
import { identityProvider } from '../../../_shared/identity/provider-registry'
import { setStateCookie } from '../google-state.cookie'
import { startGoogleSignIn } from './google-start.logic'

export const googleStartRoute = new Hono<AppEnv>().get('/sessions/google', (c) => {
  const provider = identityProvider(c.var.env)
  const { state, url } = startGoogleSignIn({ provider, origin: new URL(c.req.url).origin })
  setStateCookie(c, state)

  return c.redirect(url, 302)
})
