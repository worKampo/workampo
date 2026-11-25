import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import type { AppEnv } from '../../../_shared/http/app-env'
import { pageQuerySchema } from '../../../_shared/pagination/page-query'
import { tenantUrl } from '../../../_shared/tenancy/tenant-url'
import { requireSession } from '../../../access/require-session.middleware'
import { CompaniesError } from '../../errors'
import { listMyCompanies } from './list-my-companies.logic'

export const listMyCompaniesRoute = new Hono<AppEnv>().get(
  '/companies',
  requireSession,
  zValidator('query', pageQuerySchema, (result) => {
    if (!result.success) throw new CompaniesError('companies.invalid_request')
  }),
  async (c) => {
    const { env } = c.var
    const { companies, total } = await listMyCompanies(c.env, {
      userId: c.var.session.userId,
      page: c.req.valid('query'),
    })
    const urlOptions = {
      mode: env.TENANT_ROUTING,
      publicBaseUrl: env.PUBLIC_BASE_URL,
      hostSuffix: env.TENANT_HOST_SUFFIX,
    }

    return c.json({
      items: companies.map(({ name, slug }) => ({
        name,
        slug,
        url: tenantUrl(slug, '/', urlOptions),
      })),
      total,
    })
  },
)
