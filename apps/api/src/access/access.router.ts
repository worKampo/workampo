import { Hono } from 'hono'
import type { AppEnv } from '../_shared/http/app-env'
import { toProblem } from '../_shared/http/problem-json'
import { sessionRouter } from './session/session.router'
import { signInRouter } from './sign-in/sign-in.router'

export const accessRouter = new Hono<AppEnv>()
  .route('/', signInRouter)
  .route('/', sessionRouter)
  // Domain errors become problem+json; anything else goes on to the app's handler and Sentry.
  .onError((error) => {
    const problem = toProblem(error)
    if (!problem) throw error

    return problem
  })
