import { isClientVersion } from '@workampo/domain/_shared/client-version'
import { createMiddleware } from 'hono/factory'
import { tagClientVersion } from '../error-tracking/sentry-error-tracking'
import type { AppEnv } from '../http/app-env'

export const clientVersionLog = createMiddleware<AppEnv>(async (c, next) => {
  const clientVersion = c.req.header('X-Client-Version')
  if (isClientVersion(clientVersion)) {
    console.log(JSON.stringify({ clientVersion, method: c.req.method }))
    tagClientVersion(clientVersion)
  }
  await next()
})
