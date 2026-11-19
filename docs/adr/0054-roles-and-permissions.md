---
status: accepted
date: 2026-11-13
---

# ADR-0054: Roles and permissions

## Context

In the previous project the permission catalog lived in the database, synced from WorkOS, and no code consulted it; the only real check read the staff role from the JWT, so a role change did not apply until the session expired, and the "read-only" role was not enforced anywhere.

## Decision

- **Decision** (2026-11-13): fixed roles in code and permissions as a map of actions in code. No `roles`, `permissions` or `role_permissions` tables. **Critical zone** (isolation and access): security reviewer and test designer are mandatory ([ADR-0030](0030-test-designer.md), [ADR-0032](0032-security-reviewer.md)).
- **Company roles**: `owner`, `admin`, `member`, in `members.role` (text with `CHECK`, [ADR-0053](0053-code-conventions.md)). Custom roles per company only with their own ADR, if a large customer asks for it.
- **Permissions**: a map in code of action → allowed roles (`'members.invite': ['owner', 'admin']`), in the `companies` domain, and a single function `can(member, action)`. The API is the authority; the interface uses the same function only to show or hide. A unit test walks the whole matrix of roles by actions ([ADR-0029](0029-testing-strategy.md)).
- **Initial matrix**:

| Action | Owner | Admin | Member |
|---|:-:|:-:|:-:|
| Use the app and leave the company | ✓ | ✓ | ✓ |
| Invite, change role and remove admins and members | ✓ | ✓ | |
| Public page and general settings | ✓ | ✓ | |
| View billing (plan, usage, invoices) | ✓ | ✓ | |
| Change plan and payment method ([ADR-0051](0051-stripe-checkout-and-customer-portal.md)) | ✓ | | |
| Make someone an owner, remove or demote owners, transfer ownership | ✓ | | |
| Delete the company | ✓ | | |
| View the staff access history ([ADR-0050](0050-enter-as-staff-impersonation.md)) | ✓ | ✓ | |

- **Always at least one owner**: there can be several. The rule is checked in the domain and the write goes in a single `batch()` that checks it again; if two owners remove each other's role at the same time, one gets `companies.last_owner`. The sole owner cannot leave or delete their account without transferring ownership first ([ADR-0027](0027-legal-and-data-protection.md)).
- **Role changes take effect instantly**: the role is read from the database on every request, together with the membership that is already loaded when resolving the company. Never from the JWT or a session cache.
- **Interface**: what the role does not allow does not appear. Disabled with a tooltip only when the reason is not the role (sole owner) or in a read-only staff session ([ADR-0050](0050-enter-as-staff-impersonation.md)). A whole page without permission shows the "No access" state (`docs/design/patterns.md`).
- **Staff**: its own table in `DB_GLOBAL` (`staff_members`), separate from company roles. A single role for now, `admin`; `support` is added when the first support person joins. Staff additions and removals are done by the person with a script (🧑), with no screen.
- **Staff in "Enter as"** ([ADR-0050](0050-enter-as-staff-impersonation.md)): in read-only mode they see the same as an owner. With write enabled they act as an owner except for a list of forbidden actions: deleting the company, transferring ownership and changing plan or payment. Everything is recorded in the audit of [ADR-0050](0050-enter-as-staff-impersonation.md).

## Consequences

See Decision.
