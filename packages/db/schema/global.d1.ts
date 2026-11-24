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
    // Null until the user gives one.
    name: text(),
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

// Where each company's data lives. Never credentials: the binding is resolved from the Worker's env.
export const shards = sqliteTable(
  'shards',
  {
    id: text().primaryKey(),
    engine: text({ enum: ['d1'] }).notNull(),
    bindingName: text().notNull(),
    createdAt: text().notNull(),
  },
  (table) => [
    uniqueIndex('uq_shards__binding_name').on(table.bindingName),
    check('shards_engine', sql`${table.engine} IN ('d1')`),
  ],
)

export const companies = sqliteTable(
  'companies',
  {
    id: text().primaryKey(),
    // A 'deleting' company keeps its slug taken until the purge removes the row.
    slug: text().notNull(),
    name: text().notNull(),
    shardId: text()
      .notNull()
      .references(() => shards.id),
    status: text({ enum: ['active', 'trialing', 'deleting'] }).notNull(),
    createdAt: text().notNull(),
    updatedAt: text().notNull(),
    updatedBy: text().notNull(),
  },
  (table) => [
    uniqueIndex('uq_companies__slug').on(table.slug),
    index('idx_companies__shard_id').on(table.shardId),
    check('companies_status', sql`${table.status} IN ('active', 'trialing', 'deleting')`),
  ],
)

// No role here: roles are assignments in the shard, scoped to a unit.
export const members = sqliteTable(
  'members',
  {
    id: text().primaryKey(),
    tenantId: text()
      .notNull()
      .references(() => companies.id),
    userId: text()
      .notNull()
      .references(() => users.id),
    status: text({ enum: ['active', 'suspended', 'leaving'] }).notNull(),
    createdAt: text().notNull(),
    updatedAt: text().notNull(),
    updatedBy: text().notNull(),
  },
  (table) => [
    uniqueIndex('uq_members__tenant_id_user_id').on(table.tenantId, table.userId),
    index('idx_members__user_id').on(table.userId),
    check('members_status', sql`${table.status} IN ('active', 'suspended', 'leaving')`),
  ],
)

export const companyContacts = sqliteTable(
  'company_contacts',
  {
    tenantId: text()
      .notNull()
      .references(() => companies.id),
    topic: text({ enum: ['main'] }).notNull(),
    userId: text()
      .notNull()
      .references(() => users.id),
    createdAt: text().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.topic, table.userId] }),
    index('idx_company_contacts__user_id').on(table.userId),
    check('company_contacts_topic', sql`${table.topic} IN ('main')`),
  ],
)

// Not `idempotency_keys`: that name belongs to the shard.
export const companyCreationRequests = sqliteTable(
  'company_creation_requests',
  {
    userId: text()
      .notNull()
      .references(() => users.id),
    idempotencyKey: text().notNull(),
    // SHA-256 hex of the normalized body: the same key with another body is a conflict.
    bodyHash: text().notNull(),
    tenantId: text()
      .notNull()
      .references(() => companies.id),
    createdAt: text().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.idempotencyKey] }),
    index('idx_company_creation_requests__tenant_id').on(table.tenantId),
  ],
)
