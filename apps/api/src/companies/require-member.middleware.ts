import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../_shared/http/app-env'
import { resolveTenant } from '../_shared/tenancy/resolve-tenant'
import type { SessionVariables } from '../access/require-session.middleware'
import { memberRepo } from './data/member.d1.repo'
import { CompaniesError } from './errors'

export type CompanyVariables = {
  company: { tenantId: string; slug: string; name: string; shardId: string; memberId: string }
}

// Runs after requireSession. Every refusal is the same 404, so a caller cannot tell a foreign company from a missing one.
export const requireMember = createMiddleware<{
  Bindings: AppEnv['Bindings']
  Variables: AppEnv['Variables'] & SessionVariables & CompanyVariables
}>(async (c, next) => {
  const slug = resolveTenant(c.req.url, {
    mode: c.var.env.TENANT_ROUTING,
    hostSuffix: c.var.env.TENANT_HOST_SUFFIX,
  })
  const company = slug
    ? await memberRepo(c.env).findActiveMembership({ slug, userId: c.var.session.userId })
    : undefined
  if (!company) throw new CompaniesError('companies.not_found')

  c.set('company', company)
  await next()
})
