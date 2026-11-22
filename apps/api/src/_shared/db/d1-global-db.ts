import { drizzle } from 'drizzle-orm/d1'

// The only reader of the DB_GLOBAL binding: repos receive this client.
export function globalDb(env: { DB_GLOBAL: D1Database }) {
  return drizzle(env.DB_GLOBAL, { casing: 'snake_case' })
}
