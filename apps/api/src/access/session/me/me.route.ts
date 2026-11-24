import { Hono } from 'hono'
import type { AppEnv } from '../../../_shared/http/app-env'
import { requireSession, type SessionVariables } from '../../require-session.middleware'
import { readMe } from './me.logic'

export const meRoute = new Hono<AppEnv & { Variables: SessionVariables }>().get(
  '/me',
  requireSession,
  async (c) => c.json(await readMe(c.env, c.var.session.userId)),
)
