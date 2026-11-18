# Procedure: `.work/PROGRESS.md`

Current state of the work in progress, so work can stop at any moment (machine, session or tool change) and resume. Why: [ADR-0016](../adr/0016-procedure-harness.md), [ADR-0052](../adr/0052-living-specs-only-and-flow-by-size.md).

## Rules

- One per ticket branch, any size, at the repo root.
- **Overwritten**: only the current step, no history (history is in git and the issue).
- The orchestrator updates it at every step up to Document (step 7), at the end of each wave and always before stopping. It is committed on the branch.
- Never reaches `master`: it is a branch temporary, like `.work/plan.md` and `.work/tasks.md` (CI rejects the PR if any exists, [ADR-0052](../adr/0052-living-specs-only-and-flow-by-size.md), [ADR-0042](../adr/0042-traceability.md)).

## Where the state lives

Same format and always overwritten; only the place changes with the phase ([ADR-0020](../adr/0020-ticket-lifecycle.md)).

| Phase | Where |
|---|---|
| Steps 1-7 (up to Document) | `.work/PROGRESS.md` on the branch |
| Pull request (step 8) | One **"Progress"** comment on the PR, edited by the orchestrator. `pnpm work pr` copies the content there and deletes the temporary files in the same commit |
| Staging and Release (steps 9-10) | Issue comments |
| PRD cycle (P1-P3) | **"Progress"** comment on the PRD issue: a PRD has no branch ([ADR-0034](../adr/0034-prds-slicing-and-ticket-format.md)) |

## Reading order at session start

1. `AGENTS.md`
2. `.work/PROGRESS.md`, or the PR "Progress" comment if the branch has an open PR
3. The issue
4. `.work/tasks.md` and `.work/plan.md`, if they exist

Then continue from "Next". `pnpm work resume` prints this summary ([work](work.md)).

## Format

```markdown
# Progress
PRD #12 · Ticket #15 invite-by-email · Branch: feature/15-invite-by-email
Step: Build › Implement · wave 2 of 3
Done in this step: T1, T2
In progress: T3, T4
Next: pnpm check after wave 2, then T5
Waiting for human: —
Open questions: —
Updated: 2026-11-10 10:42
```

The header line uses the [traceability](traceability.md) format (`PRD #n` and `Ticket #n` with a space).
