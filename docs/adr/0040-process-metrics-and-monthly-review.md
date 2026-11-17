---
status: accepted
date: 2026-11-10
---

# ADR-0040: Process metrics and monthly review

## Context

The process needs measurement without new tools, and a recurring ritual to review it.

## Decision

- **DORA** computed from GitHub, with no new tools: deployment frequency, lead time for changes (first commit → release), change failure rate (releases with rollback, hotfix or revert), time to restore.
- **Agent-flow metrics**, automatic from GitHub and CI (the issue's "Work log" comment, the checklist, the PR's "Verification" comment): Implement ↔ Verify iterations, findings by type in Verify, size reclassifications, mandatory stops and CI duration per PR (target: under about 10 minutes, [ADR-0013](0013-ci-cd-with-github-actions.md)).
- **Monthly review** (15 min, [ADR-0052](0052-living-specs-only-and-flow-by-size.md)): automatic metrics from GitHub and CI, board and WIP, `paid-plan` marks per decision (`pnpm debt`, [ADR-0056](0056-async-work.md)), the Now/Next/Later roadmap and pruning of `docs/learnings.md` (what is already an automatic check or an `AGENTS.md` line leaves).

## Consequences

See Decision.
