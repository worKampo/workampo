import { getIsolationScope, sentry } from '@sentry/hono/cloudflare'
import type { Hono } from 'hono'
import { deployedSha } from '../client-version/cloudflare-version'
import type { AppEnv } from '../http/app-env'

// Without SENTRY_DSN (local, tests) the SDK sends nothing.
export function errorTracking(app: Hono<AppEnv>) {
  return sentry(app, (env) => ({
    dsn: env.SENTRY_DSN,
    environment: env.ENVIRONMENT,
    release: deployedSha(env),
    // The client lives as long as the isolate: deduplication would drop a repeated failure, and its
    // error reference would then have no event to find (#93).
    enableDedupe: false,
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

// The middleware captures c.error after the handler, so a tag set in onError reaches the event.
export function tagErrorReference(reference: string) {
  getIsolationScope().setTag('reference', reference)
}
