# Procedure: planning tools

Check and publish `.work/tasks.md` (format: [ADR-0020](../adr/0020-ticket-lifecycle.md), [ADR-0034](../adr/0034-prds-slicing-and-ticket-format.md)).

## `pnpm plan:check [file]`

Defaults to `tasks.md` in the current folder; use `pnpm plan:check .work/tasks.md`. Exits 1 and lists every problem:

- a dependency that is not in the table, or a task missing from the `Waves:` line (or the reverse);
- a dependency cycle;
- a task in the same wave or an earlier one than a task it depends on;
- two tasks of the same wave that touch the same path. A trailing `/` means a folder and contains everything under it.

Run it before the first wave and after every edit of the table.

## `pnpm plan:sync <issue> [file] [--dry-run]`

Writes the tasks as a checklist in the issue body, between `<!-- tasks:start -->` and `<!-- tasks:end -->` (added under `## Tasks` if missing). Status `done` is `[x]`, `doing` adds "in progress". It says when nothing changed. `GH_TOKEN` comes from the environment ([AGENTS.md](../../AGENTS.md#6-github-identity)).

## `pnpm debt`

Lists every `paid-plan(<decision>)` mark in tracked files except `.md` and `.html`, and fails on a malformed one. Valid forms: `paid-plan(ADR-0056)`, `paid-plan(D56)`. Why: [ADR-0056](../adr/0056-async-work.md).
