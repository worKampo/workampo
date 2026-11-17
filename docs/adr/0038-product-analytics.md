---
status: accepted
date: 2026-11-10
---

# ADR-0038: Product analytics

## Context

PRDs have metrics, but nothing measured them.

## Decision

**Cookieless** product analytics (no banner, [ADR-0027](0027-legal-and-data-protection.md)). Candidate: PostHog in cookieless mode; alternative: own events in D1 with aggregates. If PostHog is chosen, use its EU cloud ([ADR-0063](0063-eu-data-residency.md)).

- Events are named in English as `object_action` (`company_created`, `member_invited`), and are defined in the plan of each ticket that affects a PRD metric: `plan.md` in L; `tasks.md` or the issue in M and S.
- No personal data in events; `tenant_id` yes, for per-company metrics.
- Data suppression ([ADR-0027](0027-legal-and-data-protection.md)) includes analytics.

## Consequences

⚠ Check the limits of PostHog's free plan and its cookieless mode before choosing.
