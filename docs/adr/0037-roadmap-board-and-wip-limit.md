---
status: accepted
date: 2026-11-14
---

# ADR-0037: Roadmap, board and work-in-progress limit

## Context

The project needs a roadmap, a board and a limit on work in progress that suit continuous flow without sprints.

## Decision

- **Now / Next / Later roadmap** in the vision: no committed dates, ordered by value and risk; reviewed in the monthly review ([ADR-0040](0040-process-metrics-and-monthly-review.md)).
- **Continuous flow (Kanban)**, no sprints.
- **GitHub Projects**, columns by ticket state: Backlog → Ready (meets the DoR) → Define → Build → Review (PR open) → Staging → Release (in production, under observation) → Done (clean observation window). A **"Waiting on"** field (person / agent), which the orchestrator updates when it reaches a moment or a stop, to filter from any device (2026-11-14).
- **WIP limit**: at most 2 tickets in Build at a time and 1 PRD in slicing. Before starting something new, finish what is in progress.
- PRDs are shown in the view grouped by parent, with the progress of their sub-issues.
- **What is in progress** is visible on the board and in `pnpm work status` ([ADR-0052](0052-living-specs-only-and-flow-by-size.md)), never in `master`. S tickets go from Ready to Build without Define. `pnpm work` moves the cards up to Review; the deployment workflow moves them to Staging, Release and Done.

## Consequences

See Decision.
