# Seeds

Example data for local, test and staging ([ADR-0044](../../../docs/adr/0044-migrations-reference-data-seeds-and-backfills.md), in SQL since [ADR-0074](../../../docs/adr/0074-seeds-in-sql.md)). Never reference data: that is a data migration.

| Folder    | Database                                      |
| --------- | --------------------------------------------- |
| `global/` | `DB_GLOBAL` (`global-local`, `global-stg`)    |
| `shard/`  | `DB_SHARD_1` (`shard-1-local`, `shard-1-stg`) |

- Each folder holds `.sql` files applied in name order (`0001-companies.sql`, `0002-members.sql`).
- Deterministic: fixed IDs and fixed dates, never `random()` or the current time.
- Idempotent: `INSERT … ON CONFLICT DO NOTHING` (or `DO UPDATE`), so a second run changes nothing.
- Emails only on the test domains of [review](../../../docs/process/review.md#no-entra).

`global/0001-access.sql` holds the users and identities of the fake identity provider and an expired session. How to run it: [seeds procedure](../../../docs/procedures/seeds.md).
