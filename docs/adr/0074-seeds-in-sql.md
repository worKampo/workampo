---
status: accepted
date: 2026-11-23
related: [29, 33, 44, 53]
---

# ADR-0074: Seeds in SQL

## Context

[ADR-0044](0044-migrations-reference-data-seeds-and-backfills.md) wrote seeds in TypeScript on the Drizzle schema, so that a schema change would break the seed at compile time. Ticket 96 wrote the first seed as SQL (`packages/db/seed/global/0001-access.sql`), the person fixed the name `NNNN-<domain>.sql` on 2026-11-22, and [seeds](../procedures/seeds.md) and [code conventions](../process/code-conventions.md) already say SQL. ADR-0044 was never updated.

## Decision

Seeds are SQL files `NNNN-<domain>.sql` in `packages/db/seed/{global,shard}/`, run by `pnpm db:seed` in name order (the person, 2026-11-23). This replaces only ADR-0044's "In TypeScript on the same Drizzle schema"; its other seed rules stand (deterministic, idempotent, the fake login provider's users, never in production).

## Consequences

- The compile-time check is gone. A schema change that breaks a seed fails instead when the seed runs on the migrated database: the e2e suite seeds before it starts (`apps/api/playwright.config.ts`), in CI on every PR and in `pnpm work verify`.
- Seeds read like the migrations they follow, and the engine change studied in issue 112 must translate them too.
