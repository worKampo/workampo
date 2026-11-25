import { Hono } from 'hono'
import type { AppEnv } from '../../_shared/http/app-env'
import { listMyCompaniesRoute } from './list-my-companies/list-my-companies.route'

export const selectionRouter = new Hono<AppEnv>().route('/', listMyCompaniesRoute)
