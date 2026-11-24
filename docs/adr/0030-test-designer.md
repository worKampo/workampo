---
status: accepted
date: 2026-11-14
---

# ADR-0030: Test designer

## Context

Whoever designs the tests must not be whoever implements (same reason as the independent reviewers of [ADR-0021](0021-orchestrator-and-subagents.md)). If the same agent system writes the tests and the code, a shared misunderstanding comes out green.

## Decision

- **Principle**: whoever designs the tests is not whoever implements.
- **Role** (`docs/agents/test-designer.md`): receives the change spec and the plan (`plan.md` or `tasks.md`), **not** the implementation. Delivers the cases per layer tied to the spec's examples, plus the edge cases of [ADR-0029](0029-testing-strategy.md), and **writes them as failing tests** (`it.fails`, [ADR-0020](0020-ticket-lifecycle.md)): they are the first wave of `tasks.md`.
- Level `standard`; `max` in critical zones.
- When it is mandatory: by size ([ADR-0052](0052-living-specs-only-and-flow-by-size.md)).
- **Protected acceptance scenarios** (2026-11-14): the acceptance tests are written and fixed by someone other than the implementer, before any implementation exists. If the same agent system writes the tests and the code, a shared misunderstanding comes out green.
  - **What they are**: one Playwright E2E for each example approved at moment 1 ([ADR-0020](0020-ticket-lifecycle.md)), which cites its `@id` and walks the app as a user would (interface or public API), in `apps/<app>/e2e/acceptance/`. When they are mandatory: by size ([ADR-0052](0052-living-specs-only-and-flow-by-size.md)). They do not run on pre-commit and do not count toward the per-wave green; they must be green in `pnpm work pr` and in CI ([ADR-0020](0020-ticket-lifecycle.md)).
  - **First, and untouchable afterwards**: in the PR, the commits that touch `e2e/acceptance/` must come before any commit that touches another path; before them only commits in `docs/**`, `PROGRESS.md`, `plan.md` and `tasks.md` are allowed. CI fails otherwise. With no force push on any branch ([ADR-0041](0041-agent-boundaries.md)), the order cannot be rewritten.
  - **Reopening them** (a badly written scenario, or an example approved again at stop 1 of [ADR-0020](0020-ticket-lifecycle.md)) requires a `/reopen-acceptance` comment from the person's account on the issue. CI checks the author: the agents' GitHub App cannot issue it ([ADR-0041](0041-agent-boundaries.md)).
  - **The implementer does not edit them** (permissions of [ADR-0041](0041-agent-boundaries.md)) and adapts the code to the spec, not to the test. It can run them and see which example fails and at which step.
  - The spec reviewer checks that there is exactly one scenario per approved example and that each says the same as its example; an example without a scenario is a Verify failure.
  - **After the merge** they stay in the E2E suite of every PR ([ADR-0029](0029-testing-strategy.md)) and are the basis of the staging smoke. Changing the scenario of an existing rule is only possible in a ticket whose moment 1 approved that change, with the same ordering rule.
- **Suggestions in other steps**: Implement, propose E2E when touching a screen or critical journey; Verify, the spec reviewer flags every example without a test as a failure; Document, propose regenerating screenshots if the interface changed.

## Updates

- 2026-11-18: a `/reopen-acceptance` comment by the person opens a new segment for the commit-order check: acceptance commits come first within each segment. A segment is marked by the commit's trailer `Reopen: <comment-id>` naming that comment, one commit per comment, not by time: commit dates are set by whoever commits (decided in issue #27).
- 2026-11-24 (the person, ticket 148): which commits may come before the acceptance ones is replaced by [ADR-0076](0076-test-placement-after-the-reorganisation.md): any that touch only `docs/` and `.work/`.

## Consequences

See Decision.
