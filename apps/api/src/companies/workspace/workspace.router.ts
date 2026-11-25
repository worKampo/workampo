import { Hono } from 'hono'
import type { AppEnv } from '../../_shared/http/app-env'
import { requireSession } from '../../access/require-session.middleware'
import { requireMember } from '../require-member.middleware'
import { readContextRoute } from './read-context/read-context.route'

// Session first: without one the answer is 401 before any company lookup.
export const workspaceRouter = new Hono<AppEnv>()
  .use(requireSession, requireMember)
  .route('/', readContextRoute)
