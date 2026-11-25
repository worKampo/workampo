# Procedure: writing tests

Strategy and layers: [ADR-0029](../adr/0029-testing-strategy.md). Test designer: [ADR-0030](../adr/0030-test-designer.md).

## `pnpm test:new <domain>/<feature>/<use-case>`

Creates `apps/api/src/<domain>/<feature>/<use-case>/<use-case>.int.test.ts` (every part in kebab-case), beside the use case it tests with one `it.fails` test against `/health`. It never overwrites a file. Then:

1. Replace the title with `@id:<domain>-<issue>-<n> <example text>`, the id from [living specs](living-specs.md).
2. Replace the body with the example's steps and expectation.

The `it.fails` form is the first wave of a ticket ([cycle](../process/cycle.md)); it becomes a plain `it` when the code makes it pass.

## Acceptance scenarios

Live in `apps/<app>/e2e/acceptance/`, one per approved example, citing its `@id`. The helpers both suites share (sign-in, codes, cookies) live in `e2e/support/acceptance-support.ts` at the repo root. Why: [ADR-0030](../adr/0030-test-designer.md).

`pnpm e2e` runs every `*.e2e.ts` of the apps with Playwright, against the API Worker's `wrangler dev` on a migrated and seeded local database, never reusing a server already running: the API's suite on port 8788 (`apps/api/.wrangler/e2e`), the web's on 8789 (`apps/api/.wrangler/e2e-web`). The API's e2e task depends on the web's (`turbo.json`), so they never run at once (two `wrangler dev` collide) and a change in either app runs both: the web's scenarios exercise the API, and the API serves the web. CI runs it on every PR for the affected apps (`.github/workflows/e2e.yml`).

Locally, Verify runs only the ticket's scenarios, by the `@id` of its new or edited examples, and none when the ticket adds or edits no example; the whole suite is CI's, with one worker and two retries (the person, 2026-11-25):

```
pnpm e2e -- --grep "@id:(companies-91-2|access-91-4)( |$)" --pass-with-no-tests
```

`( |$)` keeps `access-91-1` from matching `access-91-10`; `--pass-with-no-tests` lets the suite of an app with none of those ids pass. The e2e tasks are never cached (`"cache": false` in `turbo.json`; turbo prints `cache bypass`), only the `build` they depend on.

The Acceptance order check reads the PR's commits in topological order and never uses commit dates, because whoever makes a commit sets its date. A commit counts as code when it touches any path outside `e2e/acceptance/`, `docs/` and `.work/`. Commits that touch `e2e/acceptance/` must come before the first code commit; a commit that touches both fails, before the first code commit and after a reopen: the scenarios go in commits of their own. A merge commit counts with the files that differ from all its parents: those its resolution changed and those both sides changed, even when git combined them without a conflict. So a merge that touches `e2e/acceptance/` after code needs a `Reopen` like any other commit, and it is the only commit that may touch scenarios and code together. A later commit that touches `e2e/acceptance/` passes only if its message has a trailer `Reopen: <comment-id>` naming a comment on the ticket's issue whose body starts with `/reopen-acceptance`, written by a user (not a bot, not via an app) with admin permission on the repo. Each comment id can be used by only one commit.

## What each piece is tested with

Decided by the person on 2026-11-24. The database is always real (local D1 in workerd), providers are replaced by their fake adapter ([ADR-0029](../adr/0029-testing-strategy.md)), and the API client by `fakeApi`, an injected `fetch`.

| Piece | Tested alone with | What is replaced |
|---|---|---|
| `.logic.ts` | a direct call; it receives its dependencies as arguments (`provider`, `limits`, `env`) | the provider, by any object with its shape (`google-start.logic.test.ts`) |
| `.repo.ts` | an integration test against local D1 | nothing: it is the piece that talks to the database |
| `.route.ts` | `app.request(...)` with a test `env`, or `exports.default.fetch` | what lies below, through the registry of fakes |
| use-case `.hook.ts` (app-core) | `renderHook` with `hookWrapper` | the API, by `fakeApi` |
| page `.hook.ts` (app-core) | `renderHook`, with no DOM or router: navigation is a callback | the API, by `fakeApi`; its use-case hooks run for real |
| `.page.tsx` | `renderApp`, the whole app | the API, by `fakeApi` |

- `vi.mock` of a `.repo.ts` only for what cannot be reproduced for real, such as a race or a unique index hit; since all access to a table is in one file, that mock is the clean seam.
- Logic imports its repos, it does not receive them: isolating logic from the database goes through local D1 or `vi.mock` of the repo, not fake repos passed as arguments. On purpose, so that the code carries no dependency injection everywhere.
