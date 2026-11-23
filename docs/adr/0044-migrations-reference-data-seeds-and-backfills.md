---
status: accepted
date: 2026-11-13
---

# ADR-0044: Migrations, reference data, seeds and backfills

## Context

The project handles several kinds of database change and data, each with different environments and mechanisms. Staging should look like production in the shape of the data, never in whose data it is.

## Decision

| Type | What it is | Environments | How |
|---|---|---|---|
| **Schema migration** | Tables, columns, indexes | All | [ADR-0033](0033-expand-contract-migrations.md). `pnpm db:migration:new` wraps `drizzle-kit generate`: the SQL comes from the TypeScript schema (`packages/db/schema/global.ts`, `shard.ts`) and the command adds the headers (`-- ticket:`, `-- contract:`). Schema SQL is not written by hand |
| **Reference data** | What the system needs to work: plans, flag definitions (roles are in code, [ADR-0054](0054-roles-and-permissions.md)) | **All, production included** | Data migration (`db:migration:new --data`, wraps `drizzle-kit generate --custom`) with hand-written idempotent inserts. Never in seeds |
| **Seed** | Example data: companies, users, memberships | **Local, test and staging only** | `pnpm db:seed` |
| **Backfill** | Fill or transform existing data (e.g. the Expand step of [ADR-0033](0033-expand-contract-migrations.md)) | Whichever needs it, production included | Script in `packages/db/backfills/<date>-<slug>.ts`, idempotent and in batches; launched by a manual workflow with the person's approval, never by the automatic deployment |

- **Migration names**: `drizzle-kit` generates random names (e.g. `0000_powerful_lilandra.sql`); `pnpm db:migration:new` renames them to the format of [ADR-0053](0053-code-conventions.md) (`0007_create_invitations.sql`) before the commit.
- **Seed rules**:
  - Deterministic: fixed IDs (constant UUIDv7, [ADR-0053](0053-code-conventions.md)) and fixed dates; same data in tests, E2E and screenshots ([ADR-0028](0028-images-in-documentation.md)).
  - Idempotent: it can be run several times without duplicating.
  - Covers from the start: at least two companies (isolation suite), a user in several companies, all roles, long names and names with unicode, a deactivated company.
  - Includes the users of the fake login provider of E2E ([ADR-0029](0029-testing-strategy.md)).
  - In TypeScript on the same Drizzle schema: if the schema changes, the seed stops compiling.
  - **It refuses to run in production**, with a CI test that checks it.
  - Staging: the same seed plus whatever the tests create; it is reset with a manual workflow.
- **Rich data in staging without customer data** (2026-11-13). Staging resembles production in the shape of the data, never in whose it is. It is achieved in layers:
  - **Seed with edge cases**: the rules above, extended with right-to-left texts and an expired trial.
  - **Volume generator**: `pnpm db:seed --size=large`, with a fixed seed (same result every time): hundreds of companies and one with thousands of members, for pagination, performance and D1 limits. It arrives with the first PRD with large lists.
  - **Every production failure feeds the seed**: if real data breaks something, it is reproduced in the seed with its test before the fix, and noted in `docs/learnings.md`.
  - **Statistical profile of production**: a read-only query that returns only aggregate figures, no personal data (members per company with mean, p95 and maximum; name lengths; alphabets; languages; plan mix; size of landing sections). It tunes the volume generator and is reviewed in the monthly review ([ADR-0040](0040-process-metrics-and-monthly-review.md)). It arrives when there are real customers.
  - **Own use**: the person uses staging daily as a customer; that data is kept between deployments until the next manual reset.
  - **Deferred**: anonymized copy of production into staging. Only with an ADR and if the previous layers fall short: free text and JSON are hard to anonymize, it is still processing of personal data (GDPR, DPA) and there is a risk that someone can be re-identified.
- **Backfill rules**: in batches respecting D1 limits (100,000 rows written/day on Free); idempotent and resumable; logs its run (environment, batches, rows) in the ticket's issue; header `// ticket: #N` ([ADR-0042](0042-traceability.md)).
- **When each piece arrives**: seed and backfill infrastructure, and the manual backfill and staging-reset workflows, in the "Working foundation" PRD; first schema, first reference data and `db:migration:new` in "Access and first company".

## Consequences

See Decision.

## Updates

- 2026-11-23 (the person, ticket 135): the seed format ("In TypeScript on the same Drizzle schema") is superseded by [ADR-0074](0074-seeds-in-sql.md): seeds are SQL. The other seed rules stand.
