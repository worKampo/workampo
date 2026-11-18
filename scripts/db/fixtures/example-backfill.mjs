// Used only by backfill.test.mjs: lowercases members.email_normalized.
import { sqlLiteral } from '../d1.mjs'

export const description = 'Fill members.email_normalized from members.email'
export const database = 'shard'

export function select(limit, after) {
  return `SELECT id, email FROM members WHERE (${after} IS NULL OR id > ${after}) ORDER BY id LIMIT ${limit}`
}

export function apply(rows) {
  return rows.map(
    (row) =>
      `UPDATE members SET email_normalized = ${sqlLiteral(row.email.toLowerCase())} WHERE id = ${sqlLiteral(row.id)}`,
  )
}
