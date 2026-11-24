import { sql } from 'drizzle-orm'
import {
  type AnySQLiteColumn,
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

// Company ids and member ids come from DB_GLOBAL: ids only, never a foreign key across databases.

export const units = sqliteTable(
  'units',
  {
    // The root unit's id is the company id, so a retried creation finds the same row.
    id: text().primaryKey(),
    tenantId: text().notNull(),
    // Null only on the root.
    parentId: text().references((): AnySQLiteColumn => units.id),
    // The root has none: the company name lives in DB_GLOBAL.
    name: text(),
    kind: text().notNull(),
    // Ids from the root down to this unit, each followed by '/': a prefix filter returns the subtree.
    path: text().notNull(),
    attributes: text().notNull().default('{}'),
    isActive: integer({ mode: 'boolean' }).notNull(),
    createdAt: text().notNull(),
    updatedAt: text().notNull(),
    updatedBy: text().notNull(),
  },
  (table) => [
    uniqueIndex('uq_units__tenant_id').on(table.tenantId).where(sql`${table.parentId} IS NULL`),
    index('idx_units__tenant_id_path').on(table.tenantId, table.path),
    index('idx_units__tenant_id_parent_id').on(table.tenantId, table.parentId),
  ],
)

// By member, not by user: a re-invited member is a new member and inherits no role.
export const assignments = sqliteTable(
  'assignments',
  {
    id: text().primaryKey(),
    tenantId: text().notNull(),
    memberId: text().notNull(),
    roleKey: text({ enum: ['owner', 'admin', 'member', 'viewer'] }).notNull(),
    unitId: text()
      .notNull()
      .references(() => units.id),
    createdAt: text().notNull(),
  },
  (table) => [
    uniqueIndex('uq_assignments__tenant_id_member_id_role_key_unit_id').on(
      table.tenantId,
      table.memberId,
      table.roleKey,
      table.unitId,
    ),
    index('idx_assignments__tenant_id_unit_id').on(table.tenantId, table.unitId),
    check('assignments_role_key', sql`${table.roleKey} IN ('owner', 'admin', 'member', 'viewer')`),
  ],
)

export const companyProfiles = sqliteTable(
  'company_profiles',
  {
    tenantId: text().primaryKey(),
    defaultLanguage: text({ enum: ['en', 'es', 'ca'] }).notNull(),
    createdAt: text().notNull(),
    updatedAt: text().notNull(),
    updatedBy: text().notNull(),
  },
  (table) => [
    check('company_profiles_default_language', sql`${table.defaultLanguage} IN ('en', 'es', 'ca')`),
  ],
)
