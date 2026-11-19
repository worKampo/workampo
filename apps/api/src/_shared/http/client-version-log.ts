import { createMiddleware } from 'hono/factory'
import type { AppEnv } from './app-env'

// A build hash or a version; anything else is not logged, so the header cannot carry free text.
const CLIENT_VERSION = /^[A-Za-z0-9._-]{1,64}$/

export const clientVersionLog = createMiddleware<AppEnv>(async (c, next) => {
  const clientVersion = c.req.header('X-Client-Version')
  if (clientVersion && CLIENT_VERSION.test(clientVersion)) {
    console.log(JSON.stringify({ clientVersion, method: c.req.method }))
  }
  await next()
})
