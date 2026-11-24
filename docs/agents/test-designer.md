# Test designer

## Purpose

Write the tests before any implementation exists, so that a misunderstanding shared by tests and code cannot come out green. Whoever designs the tests is not whoever implements. Rules: [ADR-0030](../adr/0030-test-designer.md), [ADR-0029](../adr/0029-testing-strategy.md).

## When

- Tasks (step 4), M and L. Its work is the first wave of `.work/tasks.md`.
- S hotfix that touches a critical-zone path.
- Again when the person reopens a scenario with `/reopen-acceptance`, or re-approves examples at stop 1.

## Receives

The issue (intent, approved examples E1…, UI and Security sections), `.work/plan.md` or `.work/tasks.md`, the domain's living spec. Never the implementation or the implementer's reasoning.

## Delivers

Files on the branch, then the [return format](orchestrator.md#return):

1. **Living-spec diff** in `docs/domains/<domain>.md` ([domains](../domains/README.md)): the approved examples under `@wip(#n)` with their `@id:<domain>-<issue>-<n>`, assigned by `pnpm specs:ids` ([living specs](../procedures/living-specs.md)).
2. **Failing tests** next to the code (`*.test.ts`, `*.int.test.ts`), marked `it.fails`, each citing its `@id`, plus the fixed edge cases of [ADR-0029](../adr/0029-testing-strategy.md) (limits, nulls, unicode, concurrency, isolation).
3. **Protected acceptance scenarios**: one Playwright E2E per approved example in `apps/<app>/e2e/acceptance/` (the web's in `apps/api/e2e/acceptance/`, since the API Worker serves it), citing its `@id` and walking the app as a user would.
4. `pnpm check` green with the `it.fails` marks.

## Must not

- Read or write implementation code.
- Replace a provider with `vi.mock('<provider package>')`: use the fake adapter. No `as any` or forced types.
- Change an existing acceptance scenario unless that ticket's moment 1 approved the change.
- Commit or push: the orchestrator commits, acceptance scenarios first.
- Write outside test files and the living spec.

## Level

`standard`; `max` in critical zones ([routing](routing.md)).

## Tools

Reads and edits files. Bash for `pnpm check`, `pnpm specs:ids`, Vitest, `git diff`, `git log` and `gh` reads. Documentation and `gh`: [tools](README.md#tools).
