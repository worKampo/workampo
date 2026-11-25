import { Hono } from 'hono'
import type { AppEnv } from '../../../_shared/http/app-env'
import { requireSession } from '../../../access/require-session.middleware'
import { checkSlug } from './check-slug.logic'

export const checkSlugRoute = new Hono<AppEnv>().get(
  '/companies/availability',
  requireSession,
  async (c) => c.json(await checkSlug(c.env, c.req.query('slug') ?? '')),
)
