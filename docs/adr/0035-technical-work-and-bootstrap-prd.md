---
status: accepted
date: 2026-11-10
---

# ADR-0035: Technical work and bootstrap PRD

## Context

Technical work needs a defined way in, and the first PRD has to be built while the process pieces it relies on do not exist yet.

## Decision

| Case | How it enters | Example |
|---|---|---|
| Required by a feature | Tasks inside that ticket, not a ticket of its own | Invitations table, configure Brevo |
| Platform with a measurable goal | Platform PRD; its tickets are chores | Backups and recovery: restore any database in < 4 h with loss ≤ 24 h |
| Small standalone technical item | Standalone `chore` | Tune Renovate, bump Node, add a secret |

- Everything carries the support label `area:platform` (no living spec); `docs/platform.md` describes current environments, pipelines, backups and alerts ([ADR-0052](0052-living-specs-only-and-flow-by-size.md)).
- **PRD "Working foundation"** (the first on the roadmap), five chores; the detail is in its issue, PRD #4: (1) repo, monorepo and `pnpm check` · (2) GitHub as code · (3) deploy to staging and production with minimal observability · (4) context for agents · (5) process automation. Order: 1 → 2 → 4 → 3 → 5.
- **Bootstrap exceptions** (only in this PRD, while the pieces are missing):
  - Tickets 1 and 2: path S without a prior issue; their issues are created when 2 is finished and filled in with what was done.
  - Until the GitHub App exists (end of ticket 2), the agent only works locally: **the person makes the commits and pushes** and creating the repo is 🧑.
  - Until `pnpm work` and `plan:sync` exist (ticket 5), the temporary files are deleted by hand when the PR is opened and the task checklist of the issues is maintained by hand with the format of [ADR-0034](0034-prds-slicing-and-ticket-format.md).
- **Configuration as code**: `.github/labels.yml` synced; rulesets applied by script; Cloudflare resources declared in wrangler and created by script. Scripts that need admin permissions (rulesets, Environments, creating Cloudflare resources) are written by the agents and **run by the person** with their token (🧑).
- **Manual steps** marked 🧑 in `tasks.md` and in the issue's checklist (tokens, WorkOS/Stripe/Brevo accounts, approving environments). The agent never handles credentials ([ADR-0041](0041-agent-boundaries.md)).
- **"Done when" always observable**: "a test PR passes CI", never "CI configured".
- **Recurring tasks**: runbook in `docs/runbooks/` + a scheduled Action that opens the issue when it is due (cron rule of [ADR-0048](0048-separate-backoffice-worker-and-account-limits.md)).
- **Backups**: today Time Travel (7 days). The "Backups and recovery" PRD is mandatory before opening to real customers, together with the pentest ([ADR-0032](0032-security-reviewer.md)).

## Consequences

- The bootstrap exceptions apply only to the "Working foundation" PRD.
- The "Backups and recovery" PRD is mandatory before opening to real customers.

## More information

Related: [ADR-0034](0034-prds-slicing-and-ticket-format.md), [ADR-0041](0041-agent-boundaries.md).
