# Critical paths

Paths of the critical zones of [ADR-0052](../adr/0052-living-specs-only-and-flow-by-size.md): session, isolation, migrations, billing, secrets. A PR whose diff touches one needs `size:L` on its issue; the Size check of `pnpm check:pr` fails otherwise ([traceability](traceability.md#ci-checks)).

## Format

Each line is `- ` followed by one glob in backticks, then a dash and the reason. The check reads only those lines, with Node's `path.matchesGlob`. Add the path when the code lands, in the same PR.

## Paths

- `packages/db/migrations/**` - schema and data migrations ([ADR-0033](../adr/0033-expand-contract-migrations.md)).
- `apps/*/src/_shared/identity/**` - identity providers and login (the session lives under `apps/api/src/access/**`).
- `apps/*/src/_shared/rate-limit/**` - limits on sign-in codes and attempts and on company creation.
- `apps/api/src/_shared/tenancy/**` - tenant resolution and the shard client, the base of isolation.
- `apps/api/src/companies/require-member.middleware.ts` - the membership check on every company route (isolation).
- `apps/api/src/companies/data/member.d1.repo.ts` - the one query that decides company access (isolation).
- `apps/api/src/companies/workspace/workspace.router.ts` - mounts every company route behind the membership check (isolation).
- `apps/api/src/_shared/db/d1-shard-db.ts` - the only reader of the shard bindings, fails closed on an unknown one (isolation).
- `apps/api/e2e/acceptance/isolation.e2e.ts` - the suite that proves a foreign session gets 404 on every company route.
- `packages/domain/src/companies/**` - company creation rules.
- `packages/domain/src/_shared/slug.ts` - tenant slug rules, which tenancy validates with.
- `apps/api/src/access/**` - tenant isolation, permissions and the session (the web's screens are not critical; the person, 2026-11-23).
- `apps/*/src/billing/**` - billing.
- `scripts/github/app-token.mjs` - mints the agents' App token.
- `scripts/cloudflare/**` - provisions Cloudflare resources and secrets.
- `.github/workflows/**` - CI, deploy and the secrets they use.
- `.claude/hooks/**` - guards that protect secrets and acceptance tests.
- `apps/api/wrangler.jsonc` - bindings and environments.
