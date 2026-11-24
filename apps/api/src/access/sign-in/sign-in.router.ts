import { Hono } from 'hono'
import type { AppEnv } from '../../_shared/http/app-env'
import { googleCallbackRoute } from './google-callback/google-callback.route'
import { googleStartRoute } from './google-start/google-start.route'
import { startCodeRoute } from './start-code/start-code.route'
import { verifyCodeRoute } from './verify-code/verify-code.route'

export const signInRouter = new Hono<AppEnv>()
  .route('/', startCodeRoute)
  .route('/', verifyCodeRoute)
  .route('/', googleStartRoute)
  .route('/', googleCallbackRoute)
