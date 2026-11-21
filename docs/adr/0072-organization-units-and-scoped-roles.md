---
status: accepted
date: 2026-11-21
related: [10, 33, 50, 53, 54, 57, 71]
---

# ADR-0072: Organization units in a tree and roles scoped to a branch

## Context

[ADR-0054](0054-roles-and-permissions.md) gives each member one fixed role, from code, for the whole company. Any platform built on the base needs more: a company has an internal structure (sites, areas, teams…), and people should reach only the part that is theirs, sometimes with different roles in different parts. Later, a company will want its own roles. The person's design notes for a product built on the base proposed an organization tree, per-company roles scoped to branches and an audit of permission changes. The person agreed on what of it belongs to the base and the MVP (PRD 71, 2026-11-21).

## Decision

Decided by the person in PRD 71 (2026-11-21).

1. **Units in a tree, in each company's shard** ([ADR-0010](0010-shard-1-from-v1.md)). The company is the root and has no node. A unit has the common columns (`id` UUIDv7, `tenant_id`, `parent_id`, `name`, `kind`, `is_active`, timestamps), its `path` (the ids of its ancestors) to read a whole branch with one prefix filter, and `attributes`, dynamic JSON validated in `packages/domain` by `kind`. `kind` is free text: no names of any sector in the base. An attribute that is queried often gets a generated column and an index. Moving a unit rewrites the paths of its branch in one `batch()` and refuses a move into its own descendants. **A unit is never deleted, only deactivated**: data and history keep pointing at it.
2. **Actions (permissions) are born in code**, as in ADR-0054 (`members.invite`). Each action declares its **scope**, company or unit, and its **key is immutable**: to change one, add a new action and retire the old one, like the API ([ADR-0033](0033-expand-contract-migrations.md)).
3. **Roles and what they allow live in the database:**
   - **System roles** (`owner`, `admin`, `member`, `viewer`) and their permissions are rows of `roles` and `role_permissions` in `DB_GLOBAL`, written only by migrations, the same for every company. A new action that a system role allows ships with the migration that grants it; the deploy applies migrations before the code. The keys `owner`, `admin`, `member` and `viewer` are reserved for them.
   - **`owner` has every permission by a rule in code**, not by rows, so no migration can forget it. It is always company-wide, and ADR-0054's "at least one owner" rule stays.
   - **A company's own roles** (after the MVP, issue 76) are `roles` and `role_permissions` in its shard, with the same shape, identified only by their id. The global rows never go down to a shard; a company reads them through the service when it needs them.
   - A test that runs the migrations locally checks that every action in code is allowed by at least one system role, and that no row grants an action that does not exist. It runs in `pnpm check`.
   - The Worker keeps the system roles in memory, reloaded when the applied migration version changes; a company's assignments and own roles are read on every request.
4. **Roles are scoped to a branch.** A role assignment, in the company's shard, is a member, a role (by key for a system role, by id for an own role) and a unit; with no unit, it covers the whole company. It applies to the unit and all its descendants, and a member can have several roles in different branches.
5. **Effective permissions are the union**, computed in memory on each request and never stored: at a unit, the permissions of every assignment on it and its ancestors. There are no deny rules. `can(member, action, unit)` is a pure function in `packages/domain`; the API loads the data it needs and is the authority, and the interface uses the same function only to show or hide. A company-scope action needs it from a company-wide assignment. The mobile app (later) will receive its permissions per branch from the API, as a read-only copy.
6. **Granting**: a member can only assign a role whose permissions they hold themselves at that unit.
7. **Data**: data that belongs to a unit stores its `unit_id`, and the data access layer that already filters by `tenant_id` also filters by the branches the member can see. Data with no unit belongs to the company: anyone with a role in it can read it, and only a company-wide role can change it. A resource may be stricter, never more open.
8. **Permission changes are logged**, append-only: granting, changing or removing a role, and moving or deactivating a unit, with who, to whom, on which unit and when, and the names of that moment (person, role, unit).
9. Unit tests walk the whole matrix of roles, actions and tree levels; the isolation suite ([ADR-0029](0029-testing-strategy.md)) covers branches. Critical zone: security reviewer and test designer.

This supersedes in ADR-0054: roles and permissions only in code with no tables (system roles and their permissions are now in `DB_GLOBAL`), one role per member in `members.role` (roles move to assignments), the three-role matrix (`viewer` is added) and "custom roles only with their own ADR" (this ADR sets their shape). The staff roles of the backoffice ([ADR-0050](0050-enter-as-staff-impersonation.md)) stay apart, and role changes still take effect on the next request.

## Consequences

- Invitations carry a role and a unit (PRD 11). Membership stays in `members`; roles live in the assignments.
- Own roles, after the MVP, need no change to the resolution: it already reads roles and their permissions from tables, and only adds the shard as a source.
- After the MVP, each in its own issue: own roles per company (76), tags on units that trigger automations (77), records with a frozen snapshot of their context (78) and offline sync by branch for the mobile app (79).
