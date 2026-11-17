---
status: accepted
date: 2026-11-13
---

# ADR-0010: `DB_SHARD_1` from v1

## Context

Adding sharding later is expensive; having the mechanism from the start means it is proven from the beginning. D1 has no RLS, no interactive transactions, and its bindings are static.

## Decision

- **Decision**: each company's own data goes to the shard from day one. Company → shard routing in `DB_GLOBAL`.
- **Isolation**: D1 has no RLS. The `tenant_id` filter is applied in a mandatory data access layer, with lint rules that prevent bypassing it ([ADR-0017](0017-verifiable-harness.md)) and the isolation suite ([ADR-0029](0029-testing-strategy.md)).
- **Why**: adding sharding later is expensive; this way the mechanism is proven from the start.
- D1 bindings are static: a new shard requires a redeploy.
- **Design rule**: D1 has no interactive transactions. Whatever must be atomic fits in a single `batch()`. There is no atomicity between `DB_GLOBAL` and a shard.
- **No foreign keys across databases** (2026-11-13): relations between `DB_GLOBAL` and a shard (e.g. `tenant_id` → company) are identifiers only; foreign keys and `ON DELETE CASCADE` exist only within a single database. Deletions that cross databases are done by the application or by an idempotent, retryable process (e.g. the purge of a company, [ADR-0027](0027-legal-and-data-protection.md)).
- **Postgres shard in the future** (2026-11-13): possible later for companies that need it, connecting the Worker via Hyperdrive; it is decided with its own ADR. To keep the change bounded, the code already follows the portability rules of [ADR-0053](0053-code-conventions.md).
- **Free limits**: 500 MB per database, 10 databases, 5 GB per account, 5M rows read and 100k written per day. Paid: 10 GB per database.

## Consequences

A new shard requires a redeploy. There is no atomicity between `DB_GLOBAL` and a shard. A Postgres shard would need its own ADR.

## More information

Resolves §1 of the original spec.
