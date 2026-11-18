# Procedure: seeds and the staging reset

Example data for local, test and staging; never production. Why: [ADR-0044](../adr/0044-migrations-reference-data-seeds-and-backfills.md), [ADR-0029](../adr/0029-testing-strategy.md).

## Writing seed data

SQL files in [`packages/db/seed/`](../../packages/db/seed/README.md): `global/` for `DB_GLOBAL`, `shard/` for `DB_SHARD_1`, applied in name order.

- Deterministic: fixed IDs (constant UUIDv7) and fixed dates.
- Idempotent: `ON CONFLICT DO NOTHING` or `DO UPDATE`; a second run changes nothing.
- Emails only on the test domains (`*.test`, `example.com`); no real people.
- Reference data (plans, flag definitions) is a data migration, not a seed.

## Local: `pnpm db:seed`

```sh
pnpm --filter @workampo/api exec wrangler d1 migrations apply global-local --local
pnpm --filter @workampo/api exec wrangler d1 migrations apply shard-1-local --local
pnpm db:seed
pnpm db:seed --persist-to <dir>   # Playwright keeps its own local state
```

- Local only by construction: it takes no environment, database name or `--remote`. It always runs `wrangler d1 execute global-local|shard-1-local --local --file <f>` from `apps/api`.
- It refuses before any Wrangler call if `ENVIRONMENT` or `CLOUDFLARE_ENV` is set to anything but `local`, or if those databases do not resolve to a `local-` `database_id` in `apps/api/wrangler.jsonc`. A test in `scripts/db/seed.test.mjs` checks it.
- With no seed files it says there is nothing to seed and exits 0.

## Staging: `reset-stg` workflow

Actions → `reset-stg` → Run workflow. No inputs: staging is its only target, and there is no way to point it at production.

1. Runs in the `stg` Environment and the `deploy-stg` concurrency group, so it never overlaps a deploy.
2. For each staging database: drops every table (including `d1_migrations`), re-applies the migrations (schema and reference data), then applies the seed files.
3. With no tables and no seed files it only lists tables and prints that there is nothing to do.

It deletes everything in staging, the person's own-use data included. `scripts/db/reset-stg.mjs` refuses to run outside GitHub Actions or with any argument.
