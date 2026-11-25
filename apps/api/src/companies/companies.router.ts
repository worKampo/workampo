import { Hono } from 'hono'
import type { AppEnv } from '../_shared/http/app-env'
import { toProblem } from '../_shared/http/problem-json'
import { creationRouter } from './creation/creation.router'
import { selectionRouter } from './selection/selection.router'
import { workspaceRouter } from './workspace/workspace.router'

export const companiesRouter = new Hono<AppEnv>()
  .route('/', creationRouter)
  .route('/', selectionRouter)
  // The trailing slash keeps GET /api/t/:slug/ itself a route: mergePath drops a lone '/'.
  .route('/t/:slug/', workspaceRouter)
  // Domain errors become problem+json; anything else goes on to the app's handler and Sentry.
  .onError((error) => {
    const problem = toProblem(error)
    if (!problem) throw error

    return problem
  })
