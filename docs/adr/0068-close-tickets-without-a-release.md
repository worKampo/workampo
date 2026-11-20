---
status: accepted
date: 2026-11-20
related: [43, 45, 46]
---

# ADR-0068: Close tickets whose merge deploys no Worker

## Context

[ADR-0020](0020-ticket-lifecycle.md) closes a ticket only when the observation window of its Release comes out clean. [ADR-0060](0060-deploy-affected-workers-only.md) skips the production job when staging deploys nothing, and the observation window judges only production deploys. A ticket whose merges touch no Worker (docs, scripts, process) never gets a Release, so it never closes (#43, #45).

## Decision

- When the staging deploy of a merge ends green with no Worker affected, there is no release to observe: the `stg` job closes the tickets of that merge's `Refs:` trailers as completed, with the comment "Sin Workers afectados: nada que observar", and moves their cards to Done. Decided by the person in issue #46 (2026-11-19, decisions 1 and 2 at moment 1).
- `deploy.mjs` tells the cases apart with the output `observe=none`: only for a current run with no Worker affected. A stale run, or one with `--allow-stale`, does not emit it; its commits travel with the later deploy and its window.
- A ticket with any commit on `master`, up to its current tip, that affected a Worker is not closed this way: it waits for its observation window.
- A failed check, comment or close leaves the ticket open and fails the run; nothing closes by default.
- Every commit references only its branch ticket: commitlint rejects any other `Refs:`, so a merge cannot close an unrelated ticket ([traceability](../procedures/traceability.md)).
- This supersedes, for tickets with no Worker change, the rule of ADR-0020 that a ticket moves to Close only after a clean observation window; the rest of ADR-0020 and ADR-0060 stands.

## Consequences

- Process, docs and tooling tickets close at the end of the staging deploy, with no manual step.
- Tickets merged before this existed (#45) are closed by hand with `pnpm work close`.
- How it runs and how to check it: [deploy runbook](../runbooks/deploy.md#tickets-without-a-release).
