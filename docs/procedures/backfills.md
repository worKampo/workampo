# Procedure: backfills

Fill or transform existing data in batches, any environment, production included. Why: [ADR-0044](../adr/0044-migrations-reference-data-seeds-and-backfills.md), [ADR-0033](../adr/0033-expand-contract-migrations.md).

## Writing one

A module in `packages/db/backfills/<date>-<slug>.ts` (or `.mjs`), first line `// ticket: #N`:

```ts
import { sqlLiteral } from '../../../scripts/db/d1.mjs'

export const description = 'Fill members.email_normalized'
export const database = 'shard' // or 'global'; shard runs on every DB_SHARD_<n>

// At most `limit` rows with an `id`, ordered by id, after `after` (a SQL literal, NULL on the first batch).
export function select(limit: number, after: string) {
  return `SELECT id, email FROM members WHERE email_normalized IS NULL AND (${after} IS NULL OR id > ${after}) ORDER BY id LIMIT ${limit}`
}

export function apply(rows: { id: string; email: string }[]) {
  return rows.map((r) => `UPDATE members SET email_normalized = ${sqlLiteral(r.email.toLowerCase())} WHERE id = ${sqlLiteral(r.id)}`)
}
```

- Idempotent: running it twice changes nothing the second time (filter on what is still to do).
- Every value from a row goes through `sqlLiteral`.
- Mind D1 Free limits: 100,000 rows written per day across the account.
- A runnable example: `scripts/db/fixtures/example-backfill.mjs`, used by `scripts/db/backfill.test.mjs`.

## Running

```sh
pnpm db:backfill <name> [--env local|stg|prod] [--batch N] [--after <id>] [--dry-run]
```

- `local` (the default) runs against the local databases with `--local`.
- `stg` and `prod` run only inside GitHub Actions; elsewhere the command refuses.
- `--dry-run` runs the selects and prints the statements without writing.
- After each batch it prints the cursor (last `id`). `--after <id>` resumes from it; it needs a single database, so on several shards rerun from the start (the backfill is idempotent).
- `--batch` defaults to 100: all statements of a batch go in one command line.

## Remote: `backfill` workflow

Actions → `backfill` → Run workflow with `name` and `environment` (`stg` or `prod`).

1. Try it on `stg` first.
2. `prod` waits for the person's approval on the `prod` Environment.
3. It shares the `deploy-<env>` concurrency group, so it never overlaps a deploy. A run that waits in the group is queued (`queue: max`, up to 100) and never cancelled by a newer one.
4. Copy the run's summary (environment, batches, rows per database) to the ticket's issue.
