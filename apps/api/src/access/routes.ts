import { Hono } from 'hono'
import type { AppEnv } from '../_shared/http/app-env'
import { toProblem } from '../_shared/http/problem-json'
import { sessionRoutes } from './session/session-routes'
import { signInRoutes } from './sign-in/sign-in-routes'

export const accessRoutes = new Hono<AppEnv>()
  .route('/', signInRoutes)
  .route('/', sessionRoutes)
  // Domain errors become problem+json; anything else goes on to the app's handler and Sentry.
  .onError((error) => {
    const problem = toProblem(error)
    if (!problem) throw error

    return problem
  })
