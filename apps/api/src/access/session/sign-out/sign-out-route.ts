import { Hono } from 'hono'
import type { AppEnv } from '../../../_shared/http/app-env'
import { requireSession, type SessionVariables } from '../../require-session'
import { clearSessionCookie, readSessionCookie } from '../session-cookie'
import { signOut } from './sign-out'

export const signOutRoute = new Hono<AppEnv & { Variables: SessionVariables }>().delete(
  '/sessions/current',
  requireSession,
  async (c) => {
    // requireSession has just read this cookie.
    await signOut(c.env, readSessionCookie(c) ?? '')
    clearSessionCookie(c)

    return c.body(null, 204)
  },
)
