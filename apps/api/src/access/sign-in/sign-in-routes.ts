import { Hono } from 'hono'
import type { AppEnv } from '../../_shared/http/app-env'
import { googleRoutes } from './google/google-routes'
import { startCodeRoute } from './start-code/start-code-route'
import { verifyCodeRoute } from './verify-code/verify-code-route'

export const signInRoutes = new Hono<AppEnv>()
  .route('/', startCodeRoute)
  .route('/', verifyCodeRoute)
  .route('/', googleRoutes)
