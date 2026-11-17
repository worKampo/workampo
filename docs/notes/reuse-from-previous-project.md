# Reusable from the previous project

> Status: reference, from the section "Reutilizable del proyecto anterior" of the former decisions log (reviewed 2026-11-13). Reference only: it is rewritten inside the cycle of [ADR-0020](../adr/0020-ticket-lifecycle.md), never copied as is.

Previous project: `C:\Dev\SaaS\reference\wecampo\`. Paths are relative to `wecampo-monorepo-master/`.

| What | Where | When and how |
|---|---|---|
| Base `tsconfig` | `tsconfig.base.json` | Ticket 1: starting point, hardened according to [ADR-0017](../adr/0017-verifiable-harness.md) and without `declaration` |
| Turborepo task graph | `turbo.json` | Ticket 1: with the names of [ADR-0016](../adr/0016-procedure-harness.md) and without `^build` ([ADR-0018](../adr/0018-turborepo-and-generators.md)) |
| CI workflow skeleton | `.github/workflows/ci.yml` | Ticket 2: pinned pnpm, cache, `--frozen-lockfile`, `concurrency`; steps replaced by `pnpm check` |
| API tests with injected environment and negative webhook cases | `apps/api/src/app.test.ts` | Ticket 1 and billing PRD: as `*.int.test.ts` in workerd ([ADR-0029](../adr/0029-testing-strategy.md)) |
| Webhook registry and its test | `apps/api/src/routes/webhooks/workos/strategies/` | PRD "Plans and billing": Stripe registry according to [ADR-0053](../adr/0053-code-conventions.md) |
| `make<Entity>(overrides)` factories | `packages/core/.../application/user/user.test.ts` | First tables: with fixed UUIDv7 IDs and fixed dates ([ADR-0029](../adr/0029-testing-strategy.md), [ADR-0044](../adr/0044-migrations-reference-data-seeds-and-backfills.md)) |
| Paginated list with Drizzle | `packages/core/.../drizzle-user-repository.ts`, `domain/queries.ts` | First list (Members): with `tenant_id` and escaped search, when deciding pagination ([ADR-0053](../adr/0053-code-conventions.md)) |
| Composed UI components | `packages/ui/src/components/` | When building the SPA: without Next or next-themes, with `tokens.css`, i18n and accessibility (`docs/design/`) |
| UI audit as an accessibility checklist | `docs/superpowers/specs/2026-05-05-ui-ux-audit-fixes-design.md` | When adapting the components; the main points are already in `docs/design/patterns.md` |
| TanStack Query client and keys | `apps/bo/src/lib/query-client.ts`, `hooks/use-users.ts` | When deciding server state in the frontend ([ADR-0053](../adr/0053-code-conventions.md)) |

Not reused: Next.js with OpenNext, server actions as API, AuthKit session, CORS between origins, WorkOS as source of truth, command buses and hand-made injection, tests on in-memory fakes, migrations with manual scripts, openspec tools and `.claude/settings.local.json` (personal paths; never in the repo, [ADR-0043](../adr/0043-public-repo.md)).
