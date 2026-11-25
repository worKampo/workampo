import { assignmentRepo } from '../../data/assignment.d1.repo'
import { CompaniesError } from '../../errors'
import type { CompanyVariables } from '../../require-member.middleware'

const ROLES_BY_STRENGTH = ['owner', 'admin', 'member', 'viewer'] as const

export async function readContext(
  env: { DB_GLOBAL: D1Database },
  { tenantId, slug, name, shardId, memberId }: CompanyVariables['company'],
) {
  // The root unit's id is the company's id.
  const assigned = await (await assignmentRepo(env, shardId)).rolesOnUnit({
    tenantId,
    memberId,
    unitId: tenantId,
  })
  // shortcut: until can() in PRD #71
  const role = ROLES_BY_STRENGTH.find((key) => assigned.some(({ roleKey }) => roleKey === key))
  if (!role) throw new CompaniesError('companies.not_found')

  return { name, slug, role }
}
