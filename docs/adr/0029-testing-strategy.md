---
status: accepted
date: 2026-11-14
---

# ADR-0029: Testing strategy

## Context

Most of the risk is in how the Worker behaves on the real runtime, so tests should exercise that runtime. TDD is mandatory.

## Decision

Trophy shape: the bulk are integration tests against the real runtime. TDD is mandatory.

| Layer | Tool | What it covers | When |
|---|---|---|---|
| Unit | Vitest | Pure logic: slugs, `resolveTenant()` (both modes), Zod, permissions, section rendering | `pnpm check` |
| **Integration** | Vitest + `@cloudflare/vitest-plugin` | Real requests to the Worker in workerd with local D1/KV, migrations and seed | `pnpm check` |
| Component | Vitest + Testing Library | Only SPA components with their own logic | `pnpm check` |
| E2E | Playwright | Critical journeys against `wrangler dev`, with axe ([ADR-0031](0031-ui-ux-designer.md)) | `pnpm e2e`: mandatory in the CI of every PR that touches an app; only those of the affected apps ([ADR-0013](0013-ci-cd-with-github-actions.md)) |
| Smoke | Playwright (subset) | Staging: examples of the spec. Production: read-only | CI after every deploy |

- **Where tests live** (2026-11-13): **next to the code they test**, by default. `invite-member.ts` and `invite-member.test.ts` in the same folder; they move and are deleted together, and a module without its test is visible.
  - Suffixes by type: `*.test.ts` (unit and component) and `*.int.test.ts` (integration in workerd), so that Vitest runs each type with its own configuration.
  - Kept apart, only what tests the system and not a file: cross-cutting suites (isolation, headers) in `apps/<app>/test/`; E2E in `apps/<app>/e2e/`; shared utilities (fixtures, factories, fake login) in their own package or folder.
  - The build excludes tests and dependency-cruiser prevents production code from importing a `*.test.ts` ([ADR-0017](0017-verifiable-harness.md)).
- **Writing tests** (2026-11-13):
  - Test names in English ([ADR-0036](0036-language-and-glossary.md)).
  - No `as any` or forced types in tests.
  - Provider services are replaced by the **fake version of their adapter** ([ADR-0053](0053-code-conventions.md)), never with `vi.mock('<provider package>')`.
  - `make<Entity>(overrides)` factories with fixed UUIDv7 IDs and fixed dates, shared by tests, seed ([ADR-0044](0044-migrations-reference-data-seeds-and-backfills.md)) and E2E.
  - The API is tested by calling the app with an environment injected per test (`app.request(route, init, env)`), including the negative cases (missing or invalid webhook signature).
- **Mandatory isolation suite**: walks every route that has a company using another company's session and requires 404. New routes enter automatically.
- **Fixed edge cases**: limits, nulls, unicode, concurrency (same slug in parallel), isolation.
- **External services** (WorkOS, Stripe, Brevo) simulated by intercepting `fetch`; Stripe webhooks with real fixture signatures.
- **No coverage target in %**: every example of the living spec has at least one test that cites its `@id`; CI checks it and generates the matrix in the PR's "Verification" comment ([ADR-0052](0052-living-specs-only-and-flow-by-size.md)).
- **A single Playwright** for E2E, smoke and screenshots: same seeds and `data-testid` selectors.
- E2E with retries and traces saved on failure in CI.
- The API ↔ SPA contract is checked by the build ([ADR-0019](0019-typed-contract-with-hono-rpc.md)).
- **Login in E2E**: authentication adapter with WorkOS and a fake provider that accepts the seed's users; the fake exists only in local and test and **the production build fails if it includes it**.
- **Login in staging smoke**: real WorkOS, with test users of the staging WorkOS environment itself (created by the person, 🧑) whose emails match those of the seed; their credentials live as secrets of the GitHub Environment `stg`. Production has no test users: its smoke is read-only and without login.
- **Companies of the E2E and smoke tests** (2026-11-13): never the demo company nor, if P-1 is adopted ([global templates note](../notes/global-templates.md)), the template company.
  - Tests that only read use the seed's companies ([ADR-0044](0044-migrations-reference-data-seeds-and-backfills.md)).
  - Tests that write (invite, change role, delete the company) create their own company with slug `e2e-<random>`, so they do not step on each other when run in parallel. In staging, the smoke deletes the `e2e-…` companies when it finishes.
  - If P-1 is adopted, company creation is tested with a fixed template snapshot included in the seed.
  - The production smoke reads the demo company's public page: real and stable, without touching customer data.
  - **Demo company** (2026-11-14): `is_demo` flag on the company; it stays out of metrics, analytics and charges, and its public page carries `noindex`.

## Consequences

- **Deferred**: visual regression, load tests.

## More information

Related: [ADR-0030](0030-test-designer.md), [ADR-0031](0031-ui-ux-designer.md).
