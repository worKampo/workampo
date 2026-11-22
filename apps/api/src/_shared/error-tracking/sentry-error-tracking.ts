import { sentry } from '@sentry/hono/cloudflare'
import type { Hono } from 'hono'
import { type AppEnv, deployedSha } from '../http/app-env'

// Without SENTRY_DSN (local, tests) the SDK sends nothing.
export function errorTracking(app: Hono<AppEnv>) {
  return sentry(app, (env) => ({
    dsn: env.SENTRY_DSN,
    environment: env.ENVIRONMENT,
    release: deployedSha(env),
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      stackFrameVariables: false,
      databaseQueryData: false,
    },
  }))
}
