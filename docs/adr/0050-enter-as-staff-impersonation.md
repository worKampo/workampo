---
status: accepted
date: 2026-11-10
---

# ADR-0050: "Enter as" (staff impersonation)

## Context

Staff need to enter a company to give support. This is part of the "Staff backoffice" PRD.

## Decision

The backoffice lets staff enter a company to give support. **Critical zone**: security reviewer and test designer are mandatory ([ADR-0030](0030-test-designer.md), [ADR-0032](0032-security-reviewer.md)).

- **Rules**:
  - **Mandatory reason** (free text, minimum 10 characters) and **maximum duration of 1 hour**, with a countdown.
  - **Read-only by default.** Modifying anything requires enabling it explicitly during the session, with its own reason, and it is flagged in the log.
  - **Visible warnings** at all times in the app (amber strip, as in weCampo) and in the backoffice.
  - **Audit log**: the session (staff, company, reason, start, end, whether writing was enabled and its reason) in `staff_sessions`, in `DB_GLOBAL`. What changes during the session goes to `audit_events` with the common format of [ADR-0053](0053-code-conventions.md) (`actor_id` = the staff person, linked to their session), in the database where each change happens. It is the first audit piece of v1; the company's history arrives with the first PRD that needs it ([ADR-0053](0053-code-conventions.md)).
  - **Transparency**: company administrators see the history of staff accesses. The privacy policy and the DPA mention it ([ADR-0027](0027-legal-and-data-protection.md)).
  - **Mechanics**: the backoffice creates a special session on the app host through the one-time code of [ADR-0007](0007-central-login.md), marked with `impersonated_by`. It never reuses the backoffice cookie ([ADR-0048](0048-separate-backoffice-worker-and-account-limits.md)). On expiry or exit, the session is revoked.
  - Always with explicit confirmation from the staff person ([ADR-0041](0041-agent-boundaries.md), irreversible actions).

## Consequences

See Decision.
