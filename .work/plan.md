PRD #10 · Ticket #152 · Branch: feature/152-base-preparada-para-un-segundo-motor

Applies points 1 and 6 of ADR-0077 to today's code. No behaviour change; no Postgres.

## Changes

- **Engine in the name**: `packages/db/schema/global.ts` → `global.d1.ts`; `migrations/global/` → `global.d1/`, `migrations/shard/` → `shard.d1/` (`wrangler.jsonc` in the three environments, `drizzle.config.ts`, `apps/api/vitest.config.ts`, `pnpm db:migration:new`). drizzle-kit sees no schema change. Seeds stay in `seed/{global,shard}/`: one portable seed for every engine.
- **Atomic write inside the repo**: `data/sign-in.d1.repo.ts` receives what the sign-in decided (`newUser`, `emailChange`, `session`, `revokeTokenHash`) and runs it in one `batch()`; the logic no longer composes unexecuted queries.
- **Neutral error**: the repo turns D1's unique-index message into `UniqueViolationError` (`_shared/db/unique-violation-error.ts`); the logic's retry of two racing first sign-ins checks only that class.
- **dependency-cruiser**: `provider-in-the-name` also covers `drizzle-orm/sqlite-core` and `packages/db/schema/*.d1.ts`; `database-seam` lets logic import only the neutral `_shared/db/*-error.ts`.

## Migrations already applied

D1 records applied migrations by file name in `d1_migrations`, not by folder: stg and prod keep their history after the folder rename.

## Risks

- The race of two first sign-ins: its integration test (`@id:access-96-2`, two simultaneous first sign-ins) still passes.
- A wrong `migrations_dir`: the deploy applies migrations from the new folders; nothing new to apply, so the run shows no pending migration.

## Security

Session creation, revocation and hashing are unchanged, only moved into the repo; the reviewer checks it.
