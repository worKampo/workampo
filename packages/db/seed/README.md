# Seeds

Example data for local, test and staging ([ADR-0044](../../../docs/adr/0044-migrations-reference-data-seeds-and-backfills.md)). Never reference data: that is a data migration.

| Folder    | Database                                      |
| --------- | --------------------------------------------- |
| `global/` | `DB_GLOBAL` (`global-local`, `global-stg`)    |
| `shard/`  | `DB_SHARD_1` (`shard-1-local`, `shard-1-stg`) |

- Each folder holds `.sql` files applied in name order (`001-companies.sql`, `002-members.sql`).
- Deterministic: fixed IDs and fixed dates, never `random()` or the current time.
- Idempotent: `INSERT … ON CONFLICT DO NOTHING` (or `DO UPDATE`), so a second run changes nothing.
- Test domains only in emails (`*.test`, `example.com`).

There are no tables yet, so the set is empty and `pnpm db:seed` says there is nothing to seed. How to run it: [seeds procedure](../../../docs/procedures/seeds.md).
