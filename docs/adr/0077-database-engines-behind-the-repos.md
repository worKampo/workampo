---
status: accepted
date: 2026-11-24
related: [9, 10, 33, 44, 53, 63, 65, 74, 75]
---

# ADR-0077: Database engines behind the repos

## Context

Every database is D1 (SQLite) today. [ADR-0010](0010-shard-1-from-v1.md) already leaves room for a Postgres shard through Hyperdrive, and the person adds that `DB_GLOBAL` could move to Postgres too (2026-11-24). Neither is built now: the goal is an architecture where adding an engine touches only the data layer.

The spike of issue 112 weighed a neutral schema of our own (a `columns.ts` translated per engine), Prisma and plain Drizzle per engine, and checked the global tables in `drizzle-orm/pg-core` in a throwaway branch:

- `$inferSelect` and `$inferInsert` of `users`, `identities`, `sessions` and `rate_limit_counters` are identical in both engines; the translation is `sqliteTable` → `pgTable` and the import path.
- The repos' queries compile against Postgres almost unchanged, the counter's `ON CONFLICT DO UPDATE` included; reading one row is `.get()` in D1 and `.limit(1)` in Postgres.
- Atomic writes differ: D1 has only `batch()`, Postgres has transactions.
- drizzle-kit generates the Postgres migration without surprises.

Drizzle types every table and query by engine, so a neutral schema would still leave one repo per engine: it would add a layer of our own and save only the table declarations.

## Decision

The person, 2026-11-24:

1. **One schema, one set of migrations and one repo per engine, the engine in the name** ([ADR-0053](0053-code-conventions.md), a file that uses a provider names it): `packages/db/schema/global.d1.ts`, `migrations/global.d1/`, `access/data/user.d1.repo.ts`; a Postgres one would be `global.pg.ts`, `migrations/global.pg/`, `user.pg.repo.ts`. No neutral schema of our own.
2. **One seed file for every engine**, SQL ([ADR-0074](0074-seeds-in-sql.md)) written in the subset SQLite and Postgres both accept: only `INSERT … VALUES`, no engine functions (`datetime()`, `now()`), dates as ISO text, booleans as `TRUE`/`FALSE`, JSON as quoted text, and `ON CONFLICT DO NOTHING` for idempotence (checked on local D1, 2026-11-24). No JSON or TypeScript seeds converted per engine. When a second engine arrives its seed test runs against it too; a datum that cannot be written in the subset gets one file per engine for that seed only. **WHEN A SECOND ENGINE ARRIVES: BE CAREFUL WITH EVERY NEW SEED, AND REVIEW EVERY EXISTING SEED AGAINST BOTH ENGINES BEFORE IT RUNS THERE (the person, 2026-11-24).**
3. **A neutral repo type only with a second engine.** When it arrives, `<table>.repo.ts` holds the repo's type and picks the implementation; until then the `.d1.repo.ts` is called directly. An interface with one implementation is not written ahead.
4. **Engine of `DB_GLOBAL`: configuration per environment.** It is the entry point, so nothing can look it up: a `GLOBAL_DB_ENGINE` variable (`d1` or `pg`) with its binding (`DB_GLOBAL` or a Hyperdrive one) in `wrangler.jsonc`, validated by `env.ts` as a union like `IDENTITY_PROVIDER`, and one picker in `_shared/db/` like the identity provider registry. Not written until a second engine exists.
5. **Engine of a shard: data in `DB_GLOBAL`.** A `shards` table holds each shard's id, engine and binding name (never credentials, which stay in `wrangler` and its secrets); each company points to its shard. `_shared/tenancy/` reads that row and gives the right client. It arrives with the first shard table (issue 90).
6. **Atomic writes and engine errors stay inside the repo.** A write that must be all or nothing is one repo function that receives what was decided and runs it (`batch()` in D1, a transaction in Postgres); logic never composes unexecuted queries. A repo turns an engine error the logic must react to (a unique index hit) into a neutral error; logic never reads an engine's message.
7. **Dates stay ISO-8601 text in UTC**, always as `Date.prototype.toISOString()` writes them (`2026-11-24T09:03:21.000Z`: fixed width, milliseconds, `Z`), in both engines, so ordering, comparison and the domain's code behave the same; `timestamptz` is not used.
8. **Moving `DB_GLOBAL` to another engine is a data migration**, a one-off operation with its own runbook when it is decided: export, transform, import, switch `GLOBAL_DB_ENGINE`. The code changes only in `data/`, `_shared/db/` and `packages/db`.

## Consequences

- A second engine is new files in the data layer plus its migrations; routes, `packages/domain`, app-core and the web do not change. In the logic only the repo imports change, mechanically, from `<table>.d1.repo` to the neutral `<table>.repo` that point 3 adds then; no line of what the logic does changes.
- A second engine duplicates repos and migrations per table. That cost is accepted: it is paid only for the engine actually added, and never with an abstraction of our own.
- Known differences to keep in mind: `LIKE` is case-insensitive for ASCII in SQLite and case-sensitive in Postgres (searches already use a lowercase column, ADR-0053); booleans and JSON have their own column types per engine; latency through Hyperdrive on every request if `DB_GLOBAL` moves.
- Hyperdrive and a hosted Postgres are a spending decision ([ADR-0065](0065-zero-spend-and-free-tier-limits.md)) when they come.
- Issue 152 applies points 1 and 6 to today's code: engine in the names, the sign-in's atomic write and its unique-violation error inside the repo. Their checks go to issue 111.
