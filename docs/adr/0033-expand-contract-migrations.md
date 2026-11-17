---
status: accepted
date: 2026-11-10
---

# ADR-0033: Expand/contract migrations

## Context

**Problem**: CI migrates and then deploys; during the deploy and in any rollback, the previous code runs against the new schema. A rollback does not revert the database.

## Decision

- **Pattern** (example: rename `name` → `display_name`), three tickets with their deploy:

| Step | Migration | Code | Rollback to the previous version |
|---|---|---|---|
| 1. Expand | Adds `display_name` nullable | Writes to both; reads `display_name ?? name`; batched backfill | ✅ |
| 2. Migrate | — | Reads and writes only `display_name` | ✅ |
| 3. Contract | Drops `name` | — | ✅ |

  Step 3 only when step 2 has survived in production at least one observation window without rollback.
- **Safe in one step**: create a table, add a nullable column or one with a default, create an index.
- **Requires several steps**: rename or drop a table or column, change a type, `NOT NULL` without a default, `UNIQUE` over existing data. In SQLite, changing a type or constraints rebuilds the table: it is a contract and on large tables it can hit D1's limits.
- **Migration of all databases in CI**: folders `packages/db/migrations/global/` and `packages/db/migrations/shard/` (the latter is applied to each shard); the list of databases comes from `d1_databases`; order global → shards one by one → deploy; if one fails, it stops and does not deploy; a failure midway leaves shards on different schemas without risk (they are expansions) and on retry wrangler skips what is already applied. Last resort: Time Travel (7 days Free / 30 Paid).
- **Rules that enforce it**:
  1. `pnpm db:lint-migrations` (inside `pnpm check`) fails on contractions unless there is a header `-- contract: #<issue of the Migrate step>`. Locally it only checks the headers; CI additionally checks that this issue is already in production and that its observation window has passed.
  2. Applied migrations are not edited: CI compares with `master`.
  3. **Backward-compatibility test** in PRs with migrations: the new ones are applied and the integration tests of the previous `master` commit are run.
  4. Backfills are separate, with the rules of [ADR-0044](0044-migrations-reference-data-seeds-and-backfills.md).
  5. When the Expand ticket is closed, the orchestrator opens the linked Migrate and Contract tickets.
  6. Migrations always in sequence in `tasks.md`; critical zone (test designer and security reviewer mandatory).

## Consequences

See Decision.

## More information

Related: [ADR-0044](0044-migrations-reference-data-seeds-and-backfills.md).
