---
status: accepted
date: 2026-11-10
---

# ADR-0039: Operations and incidents

## Context

The system needs defined service levels, monitoring, an incident process and a single place to see the health of the whole system.

## Decision

- **Initial SLOs** (`docs/platform.md`): API availability 99.5 % monthly; API latency p95 < 500 ms. They are reviewed with real data.
- **External availability monitor** (free service, to be chosen in the "Working foundation" PRD) on `/health` of each Worker ([ADR-0048](0048-separate-backoffice-worker-and-account-limits.md)), plus **Sentry alerts** for new errors and spikes.
- **Severities** (label `sev:1`–`sev:3` on the incident issue):

| SEV | What it is | Response |
|---|---|---|
| 1 | Outage, data loss or leak, broken login, wrong charges | Immediate: turn off the flag or roll back → `hotfix/` |
| 2 | Important functionality broken for many users | Same day → `hotfix/` |
| 3 | Minor error or one with a workaround | `bugfix/`, normal cycle |

- **Process**: detect → mitigate (flag or rollback) → fix → **blameless postmortem** for SEV1 and SEV2 (`docs/process/postmortem-template.md`: timeline, impact, root cause, what worked, actions with an issue). The actions enter as tickets and the learnings go to `docs/learnings.md` ([ADR-0052](0052-living-specs-only-and-flow-by-size.md)), or directly to an automatic check, `AGENTS.md` or the procedures.
- **Runbooks** in `docs/runbooks/`: deployment, rollback, D1 restore, secret rotation, domain purchase ([ADR-0014](0014-buying-a-domain-is-a-config-change.md)).
- **"System health" page in the backoffice** ("Staff backoffice" PRD): the health of the whole system in one place, per environment. Initial elements:

| Element | Source | What it shows |
|---|---|---|
| Availability | External monitor on `/health` | Current status, uptime of the month against the SLO |
| Deployed version | `/health` of each Worker | SHA, PR and date per Worker and environment |
| Errors | Sentry | New errors and error rate of the last 24 h |
| Performance | Cloudflare Analytics | p95 latency against the SLO, CPU per request |
| Plan quotas | Cloudflare Analytics | Requests of the day / 100,000, rows written in D1 / 100,000, KV writes / 1,000, size of each database / 500 MB ([ADR-0048](0048-separate-backoffice-worker-and-account-limits.md)) |
| Scheduled tasks | Last cron of each Worker and scheduled GitHub Actions | Last run, status and next run |
| Deployments and backups | GitHub Actions | Last deployment per environment, age of the last backup |

  - Colour thresholds (normal / warning / critical), e.g. a warning at 80 % of any quota, aligned with D26 of the original spec (§26).
  - Read-only. Read tokens (Cloudflare, Sentry, monitor, GitHub) as secrets of the `bo` Worker, created by the person (🧑, [ADR-0041](0041-agent-boundaries.md)).
  - Data cached for a few minutes: the page must not spend the quota it watches nor exceed 50 subrequests per invocation ([ADR-0048](0048-separate-backoffice-worker-and-account-limits.md)).
  - Reference design: the "System health" screen of the design canvas (Staff backoffice page).

## Consequences

See Decision.

- **2026-11-17**: monitor chosen: UptimeRobot Free (commercial use allowed, 5-minute checks, email alerts). It receives only the public `/health` URLs and the alert email. It is added to the sub-processor list.
