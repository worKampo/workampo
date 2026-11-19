# Critical paths

Paths of the critical zones of [ADR-0052](../adr/0052-living-specs-only-and-flow-by-size.md): session, isolation, migrations, billing, secrets. A PR whose diff touches one needs `size:L` on its issue; the Size check of `pnpm check:pr` fails otherwise ([traceability](traceability.md#ci-checks)).

## Format

Each line is `- ` followed by one glob in backticks, then a dash and the reason. The check reads only those lines, with Node's `path.matchesGlob`. Add the path when the code lands, in the same PR.

## Paths

- `packages/db/migrations/**` - schema and data migrations ([ADR-0033](../adr/0033-expand-contract-migrations.md)).
- `apps/*/src/_shared/auth/**` - session and login.
- `apps/*/src/access/**` - tenant isolation and permissions.
- `apps/*/src/billing/**` - billing.
- `scripts/github/app-token.mjs` - mints the agents' App token.
- `scripts/cloudflare/**` - provisions Cloudflare resources and secrets.
- `.github/workflows/**` - CI, deploy and the secrets they use.
- `.claude/hooks/**` - guards that protect secrets and acceptance tests.
- `apps/api/wrangler.jsonc` - bindings and environments.
