import { Hono } from 'hono'
import { requireSession, type SessionVariables } from '../../_shared/auth/require-session'
import { clearSessionCookie, readSessionCookie } from '../../_shared/auth/session-cookie'
import type { AppEnv } from '../../_shared/http/app-env'
import { AccessError } from '../errors'
import { userRepo } from '../users/user-repo'
import { signOut } from './sign-out'

export const sessionRoutes = new Hono<AppEnv & { Variables: SessionVariables }>()
  .get('/me', requireSession, async (c) => {
    const user = await userRepo(c.env).findById(c.var.session.userId)
    if (!user) throw new AccessError('access.unauthenticated')

    return c.json(user)
  })
  .delete('/sessions/current', requireSession, async (c) => {
    // requireSession has just read this cookie.
    await signOut(c.env, readSessionCookie(c) ?? '')
    clearSessionCookie(c)

    return c.body(null, 204)
  })
