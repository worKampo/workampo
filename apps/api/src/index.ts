import { Hono } from 'hono'
import type { AppEnv } from './_shared/http/app-env'
import { appVersionHeader } from './_shared/http/app-version-header'
import { clientVersionLog } from './_shared/http/client-version-log'

const app = new Hono<AppEnv>()

app.use(clientVersionLog)
app.use(appVersionHeader)

app.get('/health', (c) =>
  c.json({
    status: 'ok',
    sha: c.env.CF_VERSION_METADATA.tag || 'local',
    version: c.env.CF_VERSION_METADATA.id,
  }),
)

export default app
