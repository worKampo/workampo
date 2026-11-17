---
status: accepted
date: 2026-11-10
---

# ADR-0048: Backoffice as a separate Worker and Cloudflare account limits

## Context

The backoffice needs stronger isolation than the company app (security). The Cloudflare Free plan limits apply per account and constrain how Workers, databases, crons and requests are used.

## Decision

- **Separate backoffice** (security): its own Worker (`bo`, `bo-stg`) with its own host ([ADR-0006](0006-same-origin-route-map.md), [ADR-0011](0011-environments-without-extra-domain-cost.md)), on the same D1 databases as the app (it adds no databases).
  - Different origin: its `__Host-` session cookie is a different one; a company session is never valid in the backoffice nor the other way round ([ADR-0008](0008-own-session-in-d1-host-only-cookie.md)).
  - Staff login on its own host, with WorkOS and a staff role in `DB_GLOBAL`; it does not go through the central company login ([ADR-0007](0007-central-login.md)).
  - Stricter CSP and headers; its own deployment and rollback.
  - To be assessed in its PRD: **Cloudflare Access** (Zero Trust, free up to 50 users) in front of the backoffice. ⚠ Verify that it works with workers.dev hosts.
  - It is created in the "Staff backoffice" PRD, not in "Working foundation".
- **Relevant Free plan limits** (documentation of Oct 2026):

| Limit | Free | Scope | Planned use |
|---|---|---|---|
| Workers | 100 | Account | 4 (`app`, `app-stg`, `bo`, `bo-stg`) |
| Requests | 100,000/day | **Account** (all Workers together) | Shared by environments, smoke tests and monitor |
| D1 databases | **10** | Account | 4 (2 per environment); room for 3 more shards per environment |
| Cron triggers | **5** | **Account** | See rule |
| Subrequests | 50 per invocation | Request | Bulk operations in batches |
| D1 queries | 50 per invocation (`batch()` = 1) | Request | Reinforces [ADR-0010](0010-shard-1-from-v1.md) |

- **Cron rule**: **a single cron trigger per Worker** that dispatches the internal tasks (cleanup of sessions and redemption codes, aggregates); tasks that do not need to run inside Cloudflare (backups, staging reset, drills, opening recurring issues) are **scheduled GitHub Actions** (no cost in a public repo, [ADR-0043](0043-public-repo.md)).
- **External monitor**: only `/health`, every 5 minutes (≈ 600 requests/day across both environments and both Workers).

## Consequences

⚠ Verify whether requests to Static Assets count towards the daily quota (the pricing page listed them as free and unlimited; the limits page does not clarify).
