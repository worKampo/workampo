import { Hono } from 'hono'
import { errorTracking } from './_shared/error-tracking/error-tracking'
import { type AppEnv, deployedSha } from './_shared/http/app-env'
import { appVersionHeader } from './_shared/http/app-version-header'
import { clientVersionLog } from './_shared/http/client-version-log'

const app = new Hono<AppEnv>()

app.use(errorTracking(app))
app.use(clientVersionLog)
app.use(appVersionHeader)

app.get('/health', (c) =>
  c.json({
    status: 'ok',
    sha: deployedSha(c.env) ?? 'local',
    version: c.env.CF_VERSION_METADATA.id,
  }),
)

app.get('/__debug/error', (c) => {
  if (c.env.ENABLE_DEBUG_ERROR !== 'true') return c.notFound()
  throw new Error('Debug error to verify error tracking')
})

export default app
