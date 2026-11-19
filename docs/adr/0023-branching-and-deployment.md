---
status: accepted
date: 2026-11-10
---

# ADR-0023: Branching and deployment

## Context

Changes need a single path from branch to production, and a rule for what to do when something fails on the way. `master` must stay deployable, and urgent production fixes need their own lane that still passes through staging.

## Decision

```
feature|bugfix|hotfix/<issue>-<slug>  ← from master
  → PR to master (CI + AI review; reviews addressed)
  → moment 2: the person checks locally (pnpm work verify) and approves → squash merge
  → automatic deploy to staging → smoke
       ✗ → revert on master if not fixed right away → bugfix/ → repeat
  → moment 3: the person tests what was marked and approves → production (the same commit)
       ✗ → turn the flag off or roll back the Worker → hotfix/ → repeat, passing through staging
  → clean observation window → Close
```

- Main branch: **`master`**, protected (PR required, CI green, branch up to date, human approval).
- **`master` is always deployable**: revert before fixing on top of a broken `master`. Squash merge = one ticket, one commit, one revert.
- Large or risky features go behind a feature flag: deploying ≠ activating.
- **bugfix vs hotfix** (by urgency, not by where it is detected):
  - `bugfix/`: a bug that did not reach production, or that in production can wait. Normal cycle.
  - `hotfix/`: a bug in production that affects users and cannot wait (SEV1/SEV2, [ADR-0039](0039-operations-and-incidents.md)). First turn the flag off or roll back; path S, with the L reviewers if it touches a critical-zone route ([ADR-0052](0052-living-specs-only-and-flow-by-size.md)); priority over everything else; **it still passes through staging**. The person confirms it.
- Optional future: per-PR previews before merge (today this clashes with having a single set of staging D1 databases).

## Consequences

- A failed smoke on staging is reverted on `master` if it is not fixed right away.
- A failure in production means turning the flag off or rolling back the Worker, then a `hotfix/` that passes through staging again.
- Per-PR previews are deferred.
