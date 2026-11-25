import type { PageQuery } from '../../../_shared/pagination/page-query'
import { memberRepo } from '../../data/member.d1.repo'

export async function listMyCompanies(
  env: { DB_GLOBAL: D1Database },
  { userId, page }: { userId: string; page: PageQuery },
) {
  const { rows, total } = await memberRepo(env).listActiveCompanies(userId, page)

  return { companies: rows, total }
}
