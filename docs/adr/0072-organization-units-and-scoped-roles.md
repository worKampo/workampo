---
status: accepted
date: 2026-11-21
related: [10, 53, 54, 57, 71]
---

# ADR-0072: Organization units in a tree and roles scoped to a branch

## Context

[ADR-0054](0054-roles-and-permissions.md) gives each member one fixed role for the whole company. Any platform built on the base needs more: a company has an internal structure (sites, areas, teams…), and people should reach only the part that is theirs, sometimes with different roles in different parts. The person's design notes for a product built on the base proposed a single organization tree, per-company roles scoped to branches, an audit of permission changes and frozen snapshots. The person agreed on what of it belongs to the base and the MVP (PRD 71, 2026-11-21).

## Decision

Decided by the person in PRD 71 (2026-11-21).

1. **Units in a tree, in each company's shard** ([ADR-0010](0010-shard-1-from-v1.md)). The company is the root and has no node. A unit has the common columns (`id` UUIDv7, `tenant_id`, `parent_id`, `name`, `kind`, `is_active`, timestamps), its `path` (the ids of its ancestors) to read a whole branch with one prefix filter, and `attributes`, dynamic JSON validated in `packages/domain` by `kind` ([ADR-0057](0057-ready-for-a-mobile-app.md)). `kind` is free text: no names of any sector in the base. An attribute that is queried often gets a generated column and an index. Moving a unit rewrites the paths of its branch in one `batch()` and refuses a move into its own descendants.
2. **Permissions stay as in ADR-0054**: actions in code (`members.invite`) mapped to roles, one function, the API as the authority, the interface only showing or hiding.
3. **Roles stay fixed in code**, with one more: `owner`, `admin`, `member` and **`viewer`** (read only). There is no roles table: what the database stores is who has which role where.
4. **Roles are scoped to a branch.** A role assignment is a member, a role and a unit; with no unit, it covers the whole company. It applies to the unit and all its descendants, and a member can have different roles in different branches. The role that counts at a unit is the highest among the assignments on it and its ancestors (`owner` > `admin` > `member` > `viewer`). `owner` is always company-wide, and ADR-0054's "at least one owner" rule stays.
5. **`can(member, action, unit)`**. Company-wide actions (billing, general settings, deleting the company) need a company-wide role; actions on data that belongs to a unit use the role at that unit. An admin of a branch invites and manages members only within it, and never above their own role. A unit test walks the whole matrix of roles, actions and tree levels; the isolation suite ([ADR-0029](0029-testing-strategy.md)) covers branches.
6. **Data that belongs to a unit stores its `unit_id`**, and the data access layer that already filters by `tenant_id` also filters by the branches the member can see.
7. **Permission changes are logged**, append-only: who granted, changed or removed which role, to whom, on which unit and when.

This supersedes in ADR-0054: one role per member in `members.role` (roles move to assignments, a company-wide assignment being what that column was) and the three-role matrix (`viewer` is added). The rest of ADR-0054 stands.

## Consequences

- Invitations carry a role and a unit (PRD 11). Membership stays in `members`; roles live in the assignments.
- After the MVP, each in its own issue: roles each company edits (a roles table in its shard, created as a copy of the code's templates, with its own ADR), tags on units that trigger automations, records with a frozen snapshot of their context, and offline sync by branch for the mobile app.
- Critical zone: the tickets that build it are `size:L`, with the security reviewer and the test designer.
