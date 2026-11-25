import { companies } from '@workampo/db/schema/global.d1'
import { eq } from 'drizzle-orm'
import { globalDb } from '../../_shared/db/d1-global-db'

export function companyRepo(env: { DB_GLOBAL: D1Database }) {
  const db = globalDb(env)

  return {
    // Any status counts, including deleting: the slug stays reserved until the company is gone.
    slugExists: async (slug: string) =>
      (await db
        .select({ id: companies.id })
        .from(companies)
        .where(eq(companies.slug, slug))
        .get()) !== undefined,
  }
}
