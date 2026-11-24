# Procedure: seeds and the staging reset

Example data for local, test and staging; never production. Why: [ADR-0044](../adr/0044-migrations-reference-data-seeds-and-backfills.md), [ADR-0029](../adr/0029-testing-strategy.md).

## Writing seed data

SQL files in [`packages/db/seed/`](../../packages/db/seed/README.md): `global/` for `DB_GLOBAL`, `shard/` for `DB_SHARD_1`, applied in name order.

- Deterministic: fixed IDs (constant UUIDv7) and fixed dates.
- Idempotent: `ON CONFLICT DO NOTHING` or `DO UPDATE`; a second run changes nothing.
- Portable SQL, so one file serves every engine ([ADR-0077](../adr/0077-database-engines-behind-the-repos.md)): only `INSERT … VALUES`, no engine functions (`datetime()`, `now()`), dates as ISO text, booleans as `TRUE`/`FALSE`, JSON as quoted text.
- Emails only on the test domains of [review](../process/review.md#no-entra); no real people.
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

Actions → `reset-stg` → Run workflow. No inputs: staging is its only target, and the workflow offers no way to choose production. The databases it wipes are those of `env.stg` in `apps/api/wrangler.jsonc`, so before the first drop the script refuses if any of their `database_id`s is also a top-level or `env.prod` one.

1. Runs in the `stg` Environment and the `deploy-stg` concurrency group, so it never overlaps a deploy. A run that waits in the group is queued (`queue: max`, up to 100) and never cancelled by a newer one.
2. For each staging database: drops every table (including `d1_migrations`), re-applies the migrations (schema and reference data), then applies the seed files.
3. With no tables it drops nothing but still applies the migrations (a lone `d1_migrations` is dropped too: its records would skip the tables it lost), so rerunning the workflow after a failure between the drop and the migrations rebuilds the schema.

It deletes everything in staging, the person's own-use data included. `scripts/db/reset-stg.mjs` refuses to run outside GitHub Actions or with any argument.
