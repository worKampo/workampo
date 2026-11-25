import { companyContacts } from '@workampo/db/schema/global.d1'
import { globalDb } from '../../_shared/db/d1-global-db'

// Writes come back unawaited so the company creation can put them in its batch().
export function companyContactRepo(env: { DB_GLOBAL: D1Database }) {
  const db = globalDb(env)

  return {
    create: (contact: typeof companyContacts.$inferInsert) =>
      db.insert(companyContacts).values(contact),
  }
}
