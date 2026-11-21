---
status: accepted
date: 2026-11-21
related: [10, 33, 50, 53, 54, 57, 71]
---

# ADR-0072: Organization units in a tree and roles scoped to a branch

## Context

[ADR-0054](0054-roles-and-permissions.md) gives each member one fixed role, from code, for the whole company, and [ADR-0053](0053-code-conventions.md) keeps that role in `members`, in `DB_GLOBAL`. Any platform built on the base needs more: a company has an internal structure (sites, areas, teams…), and people should reach only the part that is theirs, sometimes with different roles in different parts. Later, a company will want its own roles. The person's design notes for a product built on the base proposed an organization tree, per-company roles scoped to branches and an audit of permission changes. The person agreed on what of it belongs to the base and the MVP (PRD 71, 2026-11-21).

## Decision

Decided by the person in PRD 71 (2026-11-21).

1. **Global knows who belongs where; the shard knows what they can do there.**
   - `members` in `DB_GLOBAL` is one row per person and company with a status (active, suspended, leaving) and **no role**. An active row is the door: every permission check starts there, and changing its status cuts access at once without touching the shard.
   - `invitations` stay in `DB_GLOBAL`, with the role and the unit the person will get.
   - Roles, assignments and the tree live in the company's shard ([ADR-0010](0010-shard-1-from-v1.md)).
2. **Units in a tree, in the shard.** A unit has the common columns (`id` UUIDv7, `tenant_id`, `parent_id`, `name`, `kind`, `is_active`, timestamps), its `path` (the ids of its ancestors) to read a whole branch with one prefix filter, and `attributes`, dynamic JSON validated in `packages/domain` by `kind`. `kind` is free text (the company, a physical area, a logical group…): no names of any sector in the base. An attribute that is queried often gets a generated column and an index.
   - **The company has an explicit root unit**, of kind `company`, created with the company: unique, never moved, deactivated or deleted. It stores no name or logo, which live only in `DB_GLOBAL` (ADR-0053). Its empty parent only says it is the root.
   - Moving a unit rewrites the paths of its branch in one `batch()` and refuses a move into its own descendants. **A unit is never deleted, only deactivated**; the assignments on a deactivated unit stop granting.
   - A tree gives each unit one parent. A grouping that crosses branches (a batch that moves between areas) is not a unit: it is planned after the MVP, with issue 77.
3. **Actions (permissions) are born in code**, as in ADR-0054 (`members.invite`). Each action declares its **scope**, company or unit, and its **key is immutable**: to change one, add a new action and retire the old one, like the API ([ADR-0033](0033-expand-contract-migrations.md)). Managing the tree is one more action (`units.manage`), allowed only below where the member holds it.
4. **Roles and what they allow live in the database:**
   - **System roles** (`owner`, `admin`, `member`, `viewer`) and their permissions are rows of `roles` and `role_permissions` in `DB_GLOBAL`, written only by migrations, the same for every company. A new action that a system role allows ships with the migration that grants it; the deploy applies migrations before the code. Those four keys are reserved.
   - **`owner` has every permission by a rule in code**, not by rows, so no migration can forget it. It is assigned on the root, and ADR-0054's "at least one owner" rule stays, checked and written in one `batch()` of the shard.
   - **A company's own roles** (after the MVP, issue 76) are `roles` and `role_permissions` in its shard, with the same shape, identified only by their id. The global rows never go down to a shard; a company reads them through the service when it needs them.
   - A test that runs the migrations locally checks that every action in code is allowed by at least one system role, and that no row grants an action that does not exist. It runs in `pnpm check`.
   - The Worker keeps the system roles in memory, reloaded when the applied migration version changes.
5. **Assignments** in the shard: a member, a role (by key for a system role, by id for an own role) and a unit, always explicit, with a foreign key to the unit. "The whole company" is an assignment on the root. A member can have several roles on the same path and in different branches.
6. **Effective permissions are the union**, computed in memory on each request and never stored: at a unit, the permissions of every active assignment on it and its ancestors. There are no deny rules. `can(member, action, unit)` is a pure function in `packages/domain`; the API loads the data it needs and is the authority, and the interface uses the same function only to show or hide. A company-scope action is checked on the root. The mobile app (later) will receive its permissions per branch from the API, as a read-only copy.
7. **Granting**: a member can only assign a role whose permissions they hold themselves at that unit.
8. **Data that belongs to a unit stores its `unit_id`, always explicit**: data of the whole company points to the root. A member sees the data of the units where they hold the permission; the data access layer that already filters by `tenant_id` also filters by those branches.
9. **Across the two databases**, in a fixed order that fails towards less access:
   - giving access (accepting an invitation): first the membership in `DB_GLOBAL`, then the assignment in the shard; if the second fails, the member sees nothing there until it is retried;
   - removing access: first the membership status in `DB_GLOBAL`, which cuts access at once, then an idempotent, retryable cleanup of the shard assignments.
10. **Changes are logged** in the shard, append-only, in the same `batch()` as each change: granting, changing or removing a role, and moving or deactivating a unit, with who, to whom, on which unit and when, and the names of that moment (person, role, unit). Membership changes are logged in `DB_GLOBAL`, as ADR-0053 sets; a company's history joins both by `tenant_id`.
11. **Company contacts are data, not roles**: a table in `DB_GLOBAL` of company, topic and person (an active member), so the backoffice, Stripe and legal or security notices know whom to address without opening a shard. Being a contact grants no permission. In the MVP there is one required topic, the **main contact**, given to whoever creates the company; a member who is the only contact for a required topic cannot leave until it is reassigned, checked atomically in `DB_GLOBAL`. Other topics (billing, technical, data protection, external contacts) come after the MVP, with issue 81.
12. Unit tests walk the whole matrix of roles, actions and tree levels; the isolation suite ([ADR-0029](0029-testing-strategy.md)) covers branches. Critical zone: security reviewer and test designer.

This supersedes:

- In ADR-0054: roles and permissions only in code with no tables, one role per member for the whole company, the three-role matrix (`viewer` is added) and "custom roles only with their own ADR" (this ADR sets their shape). The staff roles of the backoffice ([ADR-0050](0050-enter-as-staff-impersonation.md)) stay apart, and role changes still take effect on the next request.
- In ADR-0053, "What goes in each database": `members` keeps no role, and the role is read from the shard, so a request that checks a permission reads the shard too.

## Consequences

- Every permission check reads the shard; pages that show a company's data already did. The backoffice lists companies with their main contact from `DB_GLOBAL`, and opens a shard only for one company's detail.
- Invitations carry a role and a unit (PRD 11).
- Own roles, after the MVP, need no change to the resolution: it already reads roles and their permissions from tables, and only adds the shard as a source.
- After the MVP, each in its own issue: own roles per company (76), tags on units and groupings across branches (77), records with a frozen snapshot of their context (78), offline sync by branch for the mobile app (79) and more contact topics (81).
