# Procedure: writing tests

Strategy and layers: [ADR-0029](../adr/0029-testing-strategy.md). Test designer: [ADR-0030](../adr/0030-test-designer.md).

## `pnpm test:new <domain> <name>`

Creates `apps/api/src/<domain>/<name>.int.test.ts` (both in kebab-case) with one `it.fails` test against `/health`. It never overwrites a file. Then:

1. Replace the title with `@id:<domain>-<issue>-<n> <example text>`, the id from [living specs](living-specs.md).
2. Replace the body with the example's steps and expectation.

The `it.fails` form is the first wave of a ticket ([cycle](../process/cycle.md)); it becomes a plain `it` when the code makes it pass.

## Acceptance scenarios

Live in `apps/<app>/e2e/acceptance/`, one per approved example, citing its `@id`. Why: [ADR-0030](../adr/0030-test-designer.md).

`pnpm e2e` runs every `*.e2e.ts` of the apps with Playwright, against `wrangler dev` on a migrated and seeded local database (`apps/<app>/.wrangler/e2e`). CI runs it on every PR for the affected apps (`.github/workflows/e2e.yml`).

The Acceptance order check reads the PR's commits in topological order and never uses commit dates, because whoever makes a commit sets its date. A commit counts as code when it touches any path outside `e2e/acceptance/`, `docs/` and `.work/`. Commits that touch `e2e/acceptance/` must come before the first code commit; a commit that touches both is allowed and counts as code. A later commit that touches `e2e/acceptance/` passes only if its message has a trailer `Reopen: <comment-id>` naming a comment on the ticket's issue whose body starts with `/reopen-acceptance`, written by a user (not a bot, not via an app) with admin permission on the repo. Each comment id can be used by only one commit.
