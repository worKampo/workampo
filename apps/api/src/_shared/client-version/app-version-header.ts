import { isBelowMinimum, isBuildDate } from '@workampo/domain/_shared/client-version'
import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../http/app-env'

// From the raw bindings, so /health carries them even when the configuration fails to parse.
export const versionHeaders = createMiddleware<AppEnv>(async (c, next) => {
  await next()
  const { APP_VERSION, APP_BUILD_DATE, MIN_CLIENT_VERSION } = c.env
  if (APP_VERSION) c.header('X-App-Version', APP_VERSION)
  if (!isBuildDate(APP_BUILD_DATE) || !isBuildDate(MIN_CLIENT_VERSION)) return
  // A minimum later than this build would make every client reload forever; the value stays out of the log.
  if (isBelowMinimum(APP_BUILD_DATE, MIN_CLIENT_VERSION)) {
    console.error(JSON.stringify({ event: 'min_client_version_after_build' }))
  } else {
    c.header('X-Min-Client-Version', MIN_CLIENT_VERSION)
  }
})
