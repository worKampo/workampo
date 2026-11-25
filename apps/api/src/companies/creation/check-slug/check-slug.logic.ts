import { slugProblem } from '@workampo/domain/_shared/slug'
import { companyRepo } from '../../_repo/company.d1.repo'
import { CompaniesError } from '../../errors'

export async function checkSlug(env: { DB_GLOBAL: D1Database }, slug: string) {
  const problem = slugProblem(slug)
  if (problem) throw new CompaniesError(`companies.${problem}_slug`)

  return { available: !(await companyRepo(env).slugExists(slug)) }
}
