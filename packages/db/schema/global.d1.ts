import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

export const users = sqliteTable(
  'users',
  {
    id: text().primaryKey(),
    // Lowercase and verified by the identity provider.
    email: text().notNull(),
    createdAt: text().notNull(),
    updatedAt: text().notNull(),
  },
  (table) => [uniqueIndex('uq_users__email').on(table.email)],
)

export const identities = sqliteTable(
  'identities',
  {
    provider: text({ enum: ['workos'] }).notNull(),
    // The user's id at the provider.
    subject: text().notNull(),
    userId: text()
      .notNull()
      .references(() => users.id),
    createdAt: text().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.subject] }),
    index('idx_identities__user_id').on(table.userId),
    check('identities_provider', sql`${table.provider} IN ('workos')`),
  ],
)

export const sessions = sqliteTable(
  'sessions',
  {
    id: text().primaryKey(),
    userId: text()
      .notNull()
      .references(() => users.id),
    // SHA-256 hex of the cookie token: a copy of the database holds no usable session.
    tokenHash: text().notNull(),
    createdAt: text().notNull(),
    expiresAt: text().notNull(),
    revokedAt: text(),
  },
  (table) => [
    uniqueIndex('uq_sessions__token_hash').on(table.tokenHash),
    index('idx_sessions__user_id').on(table.userId),
  ],
)

export const rateLimitCounters = sqliteTable(
  'rate_limit_counters',
  {
    // '<purpose>:<subject kind>:<sha256 hex>'
    key: text().notNull(),
    windowStartedAt: text().notNull(),
    count: integer().notNull(),
    expiresAt: text().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.key, table.windowStartedAt] }),
    index('idx_rate_limit_counters__expires_at').on(table.expiresAt),
  ],
)
