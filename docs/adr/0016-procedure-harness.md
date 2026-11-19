---
status: accepted
date: 2026-11-13
---

# ADR-0016: Procedure harness

## Context

Repeated work should not depend on manual steps or on one tool. Each procedure is a script plus a neutral guide, and the current state of work in progress must survive a change of machine, session or tool so that work can stop at any moment and resume.

## Decision

- Each procedure = **executable script** (`pnpm …`) + **neutral guide** in `docs/procedures/<name>.md` (when, order, what to check, what not to do). In English.
- Linked from `AGENTS.md`; thin adapters per tool (Claude skills, Cursor commands).
- Added as we go: a task repeated by hand becomes a procedure.
- **Same script names in all packages** (2026-11-13): `dev`, `build`, `test`, `typecheck`, `lint`; Turborepo chains them into `check`. `lint` is always the linter (Biome), never an alias of `tsc`.
- **Initial catalog**:

| Command | Guide | Purpose |
|---|---|---|
| `pnpm check` | — | typecheck + lint + tests ([ADR-0017](0017-verifiable-harness.md)) |
| `pnpm work [inbox\|status\|resume\|start\|verify\|pr\|close]` | `work.md` | ticket cycle without manual steps: what is waiting for the person, status, resume, start, check locally, open the PR, close ([ADR-0052](0052-living-specs-only-and-flow-by-size.md)) |
| `pnpm debt` | — | lists the `paid-plan` marks ([ADR-0056](0056-async-work.md)) |
| — | `critical-paths.md` | critical-zone paths that require `size:L` ([ADR-0052](0052-living-specs-only-and-flow-by-size.md)) |
| `pnpm specs:ids` | `living-specs.md` | assigns stable `@id`s to the examples of the living specs ([ADR-0052](0052-living-specs-only-and-flow-by-size.md)) |
| `pnpm plan:check` | `planning.md` | validates dependencies, cycles and overlaps in `tasks.md` ([ADR-0020](0020-ticket-lifecycle.md)) |
| `pnpm plan:sync` | — | writes the tasks of `tasks.md` as a checklist in the issue ([ADR-0034](0034-prds-slicing-and-ticket-format.md)) |
| `pnpm db:migration:new --global\|--shard [--data]` | `db-migrations.md` | new migration: schema (wraps `drizzle-kit generate`) or reference data (`--data`, wraps `drizzle-kit generate --custom`); adds the headers of [ADR-0033](0033-expand-contract-migrations.md) and [ADR-0042](0042-traceability.md) ([ADR-0044](0044-migrations-reference-data-seeds-and-backfills.md)) |
| `pnpm db:lint-migrations` | `db-migrations.md` | blocks unauthorized contractions ([ADR-0033](0033-expand-contract-migrations.md)) |
| `pnpm test:new` | `testing.md` | integration test template with seed and mocked `fetch` ([ADR-0029](0029-testing-strategy.md)) |
| `pnpm e2e` | `e2e.md` | runs the E2E tests against `wrangler dev` ([ADR-0029](0029-testing-strategy.md)) |
| `pnpm e2e:new` | `e2e.md` | Playwright template with `data-testid` and fake login ([ADR-0029](0029-testing-strategy.md)) |
| — | `flaky-test.md` | diagnosis of unstable tests: trace, never `sleep`, quarantine with an issue and a deadline |
| `pnpm docs:new` | `help-article.md` | help guide in Starlight ([ADR-0025](0025-user-help-with-starlight.md)) |
| `pnpm changelog:new` | `changelog-entry.md` | changelog entry with `draft` according to the flag ([ADR-0026](0026-user-changelog.md)) |
| `pnpm docs:screenshots` | `help-article.md` | regenerates screenshots with Playwright and a fixed seed ([ADR-0028](0028-images-in-documentation.md)) |
| `pnpm db:seed` | `seeds.md` | deterministic data for local, test and staging; never production ([ADR-0044](0044-migrations-reference-data-seeds-and-backfills.md)) |
| `pnpm db:backfill <name>` | `backfills.md` | runs a backfill in batches; in remote environments only through an approved manual workflow ([ADR-0044](0044-migrations-reference-data-seeds-and-backfills.md)) |
| — | `progress.md` | format and rules of `PROGRESS.md` (see below) |
| — | `traceability.md` | exact traceability formats ([ADR-0042](0042-traceability.md)) |
| — | `REVIEW.md` (root) | PR review policy for human reviewers, agents and AI review ([ADR-0015](0015-agent-context-multi-tool.md)) |

- **`PROGRESS.md`: current state of the work in progress**, so work can stop at any moment and resume.
  - One per ticket branch (of any size, [ADR-0052](0052-living-specs-only-and-flow-by-size.md)), at the repo root. The cycle of a PRD (P1–P3, [ADR-0034](0034-prds-slicing-and-ticket-format.md)) has no branch: its state goes in a "Progress" comment on the PRD issue. It is **overwritten**: only the current step, no history (history is in git and the issue).
  - The orchestrator updates it at every step up to Document (step 7), at the end of each wave and always before stopping. It is committed on the branch so that it survives a change of machine, session or tool.
  - **The state changes place according to the phase**, always with the same format and overwritten:

| Phase | Where the state lives |
|---|---|
| Up to Document (steps 1–7) | `PROGRESS.md` on the branch |
| Pull request (step 8) | A single **"Progress"** comment on the PR, which the orchestrator edits. `pnpm work pr` copies the content there and deletes the temporary files in the same commit |
| Staging and Release (steps 9–10) | Issue comments ([ADR-0020](0020-ticket-lifecycle.md)) |

  - **Branch temporaries**: `PROGRESS.md`, `plan.md` and `tasks.md`; rules in [ADR-0052](0052-living-specs-only-and-flow-by-size.md).
  - When starting a session, the agent reads `AGENTS.md` → `PROGRESS.md` or, if the branch has an open PR, its "Progress" comment → the issue → `tasks.md` and `plan.md` if they exist, and continues from "Next". `pnpm work resume` prints that summary.
  - Format:
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

## Consequences

See Decision.

## Updates

- **2026-11-18** (decided by the person): the branch temporaries live in a `.work/` folder at the repo root: `.work/PROGRESS.md`, `.work/plan.md`, `.work/tasks.md`. Same rules: committed on the branch, never on `master`.
