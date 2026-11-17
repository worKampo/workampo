import { createMiddleware } from 'hono/factory'
import type { AppEnv } from './app-env'

export const clientVersionLog = createMiddleware<AppEnv>(async (c, next) => {
  const clientVersion = c.req.header('X-Client-Version')
  if (clientVersion) {
    console.log(JSON.stringify({ clientVersion, method: c.req.method, path: c.req.path }))
  }
  await next()
})
