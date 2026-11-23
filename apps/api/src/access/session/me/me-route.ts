import { Hono } from 'hono'
import type { AppEnv } from '../../../_shared/http/app-env'
import { AccessError } from '../../errors'
import { requireSession, type SessionVariables } from '../../require-session'
import { userRepo } from '../../users/user-repo'

export const meRoute = new Hono<AppEnv & { Variables: SessionVariables }>().get(
  '/me',
  requireSession,
  async (c) => {
    const user = await userRepo(c.env).findById(c.var.session.userId)
    if (!user) throw new AccessError('access.unauthenticated')

    return c.json(user)
  },
)
