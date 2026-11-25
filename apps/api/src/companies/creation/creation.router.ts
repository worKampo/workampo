import { Hono } from 'hono'
import type { AppEnv } from '../../_shared/http/app-env'
import { checkSlugRoute } from './check-slug/check-slug.route'

export const creationRouter = new Hono<AppEnv>().route('/', checkSlugRoute)
