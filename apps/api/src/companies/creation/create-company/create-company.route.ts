import { zValidator } from '@hono/zod-validator'
import { slugProblem } from '@workampo/domain/_shared/slug'
import { makeCreateCompanySchema } from '@workampo/domain/companies/creation/create-company'
import { LANGUAGES, type Language } from '@workampo/i18n'
import { Hono } from 'hono'
import { z } from 'zod'
import type { AppEnv } from '../../../_shared/http/app-env'
import { requestOrigin } from '../../../_shared/http/cloudflare-request-origin'
import { tenantUrl } from '../../../_shared/tenancy/tenant-url'
import { requireSession } from '../../../access/require-session.middleware'
import { CompaniesError } from '../../errors'
import { createCompany } from './create-company.logic'

const createCompanySchema = makeCreateCompanySchema(LANGUAGES)

export const createCompanyRoute = new Hono<AppEnv>().post(
  '/companies',
  requireSession,
  zValidator('header', z.object({ 'idempotency-key': z.uuid() }), (result) => {
    if (!result.success) throw new CompaniesError('companies.invalid_request')
  }),
  zValidator('json', createCompanySchema, (result) => {
    if (result.success) return

    const slug: unknown = (result.data as { slug?: unknown } | null)?.slug
    const problem = typeof slug === 'string' ? slugProblem(slug) : null
    throw new CompaniesError(problem ? `companies.${problem}_slug` : 'companies.invalid_request')
  }),
  async (c) => {
    const { env } = c.var
    const body = c.req.valid('json')

    const company = await createCompany(c.env, {
      limits: {
        perUser: env.RATE_LIMIT_COMPANY_CREATES_PER_USER,
        perIp: env.RATE_LIMIT_COMPANY_CREATES_PER_IP,
        windowSeconds: env.RATE_LIMIT_WINDOW_SECONDS,
      },
      request: {
        userId: c.var.session.userId,
        idempotencyKey: c.req.valid('header')['idempotency-key'],
        ipAddress: requestOrigin(c).ipAddress,
        // The schema already checked the language against LANGUAGES.
        body: { ...body, defaultLanguage: body.defaultLanguage as Language },
      },
    })
    const url = tenantUrl(company.slug, '/', {
      mode: env.TENANT_ROUTING,
      publicBaseUrl: env.PUBLIC_BASE_URL,
      hostSuffix: env.TENANT_HOST_SUFFIX,
    })

    return c.json({ ...company, url }, 201)
  },
)
