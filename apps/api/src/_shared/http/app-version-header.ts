import { createMiddleware } from 'hono/factory'
import type { AppEnv } from './app-env'

export const appVersionHeader = createMiddleware<AppEnv>(async (c, next) => {
  await next()
  if (c.env.APP_VERSION) c.header('X-App-Version', c.env.APP_VERSION)
})
