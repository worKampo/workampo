---
status: accepted
date: 2026-11-24
related: [29, 30, 74, 75]
---

# ADR-0076: Where tests live after the reorganisation

## Context

[ADR-0029](0029-testing-strategy.md) put the suites that test the system (isolation, headers) in `apps/<app>/test/` and had the `make<Entity>` factories shared by tests, seed and E2E. [ADR-0030](0030-test-designer.md) allowed, before the acceptance commits of a PR, only commits that touch `docs/**`, `.work/PROGRESS.md`, `.work/plan.md` and `.work/tasks.md`. The code no longer works that way: the suites sit beside the code they cover, seeds are SQL ([ADR-0074](0074-seeds-in-sql.md)), and `scripts/checks/acceptance-order.mjs` accepts any commit that touches only `docs/` and `.work/`.

## Decision

The person, 2026-11-24:

- `apps/<app>/test/` holds only the test setup. Every unit and integration test sits beside the code it covers: a unit test beside its file, a use case's integration test in its folder, a suite that tests the whole system beside its entry point (`apps/api/src/index.int.test.ts`, `apps/web/src/_shared/headers.test.ts`). E2E scenarios keep their own `apps/<app>/e2e/` tree, since they test the product through the browser rather than one module; which app holds each one is issue 150.
- The `make<Entity>` factories serve tests and E2E. Seeds do not use them, since they are SQL.
- Before the acceptance commits a PR may carry commits that touch only `docs/` and `.work/`, as the check does.

This replaces those three points of ADR-0029 and ADR-0030; the rest of both stands.

## Consequences

- A test is found where its code is: no separate tree to keep in step.
- The ordering check and the ADR say the same, so a plan or progress file of any name in `.work/` never blocks a PR.

## Updates

- 2026-11-24 (the person, ticket 150): E2E go with what they cover. Journeys through the pages live in `apps/web/e2e/` (sign-in screens, code, Google, the staging smoke); server behaviour in `apps/api/e2e/` (session cookie and expiry, rate limits, linking, `/health`). Both suites start the same API Worker, which serves the web; the shared helpers stay in `apps/api/e2e/acceptance/support.ts`.
- 2026-11-25 (the person, ticket 180): the helpers both e2e suites share live in `e2e/support/acceptance-support.ts` at the repo root, not in `apps/api/e2e/acceptance/support.ts`, so no app imports another app's files. `@playwright/test` is a root dev dependency and each app's tsconfig includes the folder.
