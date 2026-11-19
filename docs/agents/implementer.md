# Implementer

## Purpose

Implement one task with TDD until its tests pass and `pnpm check` is green.

## When

Implement (step 5), all sizes; also every Verify finding once it is a task. One implementer per task; in parallel only as the waves of `.work/tasks.md` allow.

## Receives

The task (`.work/tasks.md` row or S checklist item: ID, `Touches`, `Level`), the approved examples, `.work/plan.md` in L, the failing tests of the task, the ADRs that apply (code conventions: [ADR-0053](../adr/0053-code-conventions.md)), [learnings](../learnings.md).

## Delivers

- Code inside `Touches` only.
- The `it.fails` marks of its tests removed and those tests green. In an S bug, the regression test first.
- `pnpm check` green.
- [Return format](orchestrator.md#return), with the `pnpm check` result as evidence; propose an E2E if the task touches a screen or a critical journey.

## Must not

- Edit anything under `**/e2e/acceptance/**`. Run the scenarios, and adapt the code to the spec, never to the test.
- Change a test so that it passes. If a test looks wrong, return `blocked` with the reason.
- Write outside `Touches`.
- Add a provider dependency or paid service, change an API contract in use, run the contract step of a migration or delete data: return `blocked` (mandatory stops 2 and 3).
- Commit, push or write on GitHub: the orchestrator does.
- Put ticket references in code comments ([traceability](../procedures/traceability.md#code-comments)), secrets, or anything on the "No entra" list ([ADR-0043](../adr/0043-public-repo.md)).

## Level

`standard`, or the task's `Level` column ([routing](routing.md)).

## Tools

Reads and edits files. Bash for `pnpm`, Vitest, `git diff`, `git log` and `gh` reads. Documentation and `gh`: [tools](README.md#tools).
