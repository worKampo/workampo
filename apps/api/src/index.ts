import { Hono } from 'hono'
import { csrf } from 'hono/csrf'
import { parsedEnv } from './_shared/env'
import { errorTracking } from './_shared/error-tracking/sentry-error-tracking'
import { type AppEnv, deployedSha } from './_shared/http/app-env'
import { appVersionHeader } from './_shared/http/app-version-header'
import { clientVersionLog } from './_shared/http/client-version-log'
import { mountProviderPages } from './_shared/identity/provider-registry'
import { deleteExpiredCounters } from './_shared/rate-limit/delete-expired-counters'
import { accessRoutes } from './access/routes'

export const app = new Hono<AppEnv>()

app.use(errorTracking(app))
app.use(clientVersionLog)
app.use(appVersionHeader)
// A foreign page can only send a simple POST without a preflight: csrf() checks its Origin on form
// content types. DELETE, PUT and JSON bodies need a preflight our API never grants.
app.on('POST', '/api/*', csrf())
app.use('/api/*', parsedEnv)
mountProviderPages(app)

const api = app.route('/api', accessRoutes)

// The typed contract of hc (ADR-0019); clients import it as a type only.
export type AppType = typeof api

// Deploy metadata comes from the raw bindings, so /health answers even when the configuration fails to parse.
app.get('/health', (c) =>
  c.json({
    status: 'ok',
    sha: deployedSha(c.env) ?? 'local',
    version: c.env.CF_VERSION_METADATA.id,
    environment: c.env.ENVIRONMENT,
  }),
)

app.get('/__debug/error', parsedEnv, (c) => {
  if (c.var.env.ENABLE_DEBUG_ERROR !== 'true') return c.notFound()
  throw new Error('Debug error to verify error tracking')
})

export default {
  fetch: app.fetch,
  // The Worker's one daily cron (ADR-0048).
  // biome-ignore lint/complexity/useMaxParams: the signature is the Workers scheduled() contract.
  scheduled(_controller, env, ctx) {
    ctx.waitUntil(deleteExpiredCounters(env, new Date()))
  },
} satisfies ExportedHandler<AppEnv['Bindings']>
