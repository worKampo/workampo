---
status: accepted
date: 2026-11-14
---

# ADR-0056: Async work

## Context

On Workers Free the limit that matters is **CPU: 10 ms per invocation**. Waiting for the database, for `fetch` or for KV does not count. An HTTP request has no duration limit while the client stays connected, `ctx.waitUntil()` extends up to 30 s after the response, and cron and queue consumers have 15 min of duration. Moving work to the background gives duration, reliability and retries, **not more CPU**: each step keeps its own limit. Source: Workers limits documentation, consulted on 2026-11-14.

## Decision

**Decision** (2026-11-14): the pattern is designed now and built with the first real case (probably exporting or deleting a company's data, [ADR-0027](0027-legal-and-data-protection.md)).

- **Which pattern to use**:

| Work | Pattern | Example |
|---|---|---|
| Fast and mostly waiting on I/O (the normal case) | Synchronous | Save settings, invite 50 emails in batches ([ADR-0053](0053-code-conventions.md)) |
| Accessory, can be lost | `ctx.waitUntil()` after responding | Sentry, analytics |
| Long, with several steps or that cannot be lost | Cloudflare **Workflow**: state per step, retries of the failing step, waits | Export or delete a company, import a CSV |
| Heavy computation | In the browser if possible (read the CSV, shrink the image before uploading it); otherwise Workers Paid ($5/month) with an ADR | Generate a PDF |

  - **The API always validates**, even if the browser already did: the browser cannot be trusted. What changes is the size of each submission: the browser reads the whole file and sends small batches (e.g. 500 rows) that the API validates with Zod within its CPU budget.

  - Workflows before a simple queue: they store the state of each step and retry only what failed. A queue is left for high volume spread out. ⚠ Check whether Queues is in the free plan before using it.
- **Contract**:
  - Long work answers `202 Accepted` with the job id; the status is queried at `GET /api/t/:slug/jobs/:id`.
  - `jobs` table in the shard: `tenant_id`, `type`, `status` (`queued` / `running` / `succeeded` / `failed`), `progress`, reference to the result, `error_code`, `created_by`. The UI reads it even though the Workflow keeps its own state.
  - `Idempotency-Key` header on the `POST`s that create something: a retry returns the same result without duplicating (key per company and user, in the shard's `idempotency_keys` table, which expires after 24 h).
- **Notifying the UI**, in this order: poll `GET /api/t/:slug/jobs/:id` with increasing wait (each poll counts toward the 100,000 daily requests); in-app notification when done, and email if it takes long; real time with a Durable Object and WebSocket only if needed; mobile push with its adapter ([ADR-0057](0057-ready-for-a-mobile-app.md)). UI pattern in `docs/design/patterns.md`.
- **Monitoring**: the p99 CPU per route is tracked in the Worker metrics and raises an alert when it nears 10 ms ([ADR-0039](0039-operations-and-incidents.md)). It is the signal to move the computation to the browser or move to Workers Paid with an ADR.
- **`paid-plan` marks** (2026-11-14): every workaround that exists only because of a free-plan limit (Workers CPU, D1 daily rows, KV writes, Sentry, Brevo or other quotas) carries a mark in the code or in the configuration, to come back to it when paying:
  ```ts
  // paid-plan(D56): CSV parsed in the browser and sent in batches of 500.
  // Upgrade: on Workers Paid, parse and validate the whole file in a Workflow step.
  ```
  - **Fixed format**: `paid-plan(<decision>):` which workaround there is and why, and an `Upgrade:` line with what to change when paying. In English, like all comments ([ADR-0053](0053-code-conventions.md)). It is the only debt mark allowed without its own issue: the cited decision serves as the reference.
  - **The source is the code**: `pnpm debt` lists all the marks (file, line, decision, workaround and improvement); there is no other list to maintain.
  - **CI** checks the format (existing decision and `Upgrade:` line); a malformed mark breaks `pnpm check`.
  - **Agents** add the mark whenever they implement a workaround for a free limit, and note it in "Decisions made" ([ADR-0020](0020-ticket-lifecycle.md)); the spec reviewer flags a workaround without a mark as a failure.
  - **Monthly review** ([ADR-0040](0040-process-metrics-and-monthly-review.md)): number of marks per decision. When moving to a paid plan, its ADR creates a ticket for each affected mark.
  - What is not in the code (private repo, [ADR-0043](0043-public-repo.md)) keeps its own trigger.

## Consequences

- Pending check: whether Queues is included in the free plan, before using it.
- Heavy computation without a browser option requires Workers Paid with an ADR.
