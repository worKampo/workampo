PRD #4 · Ticket #9 · Branch: feature/9-process-automation

Design for automating the ticket cycle: `pnpm work`, planning tools, seeds and backfills, Playwright, the observation window and the traceability checks in CI. Facts come from the research of 2026-11-18 (current docs of Playwright, Sentry, UptimeRobot, commitlint, jscpd, GitHub).

## Delivery in four PRs

The ticket is the largest of the PRD. Each PR is reviewable on its own and leaves `master` working.

| PR  | Content                                                                                                       | Who pushes                 |
| --- | ------------------------------------------------------------------------------------------------------------- | -------------------------- |
| A   | `pnpm work`, planning tools (`plan:check`, `plan:sync`, `specs:ids`, `test:new`, `debt`) and their procedures | The App                    |
| B   | Traceability checks in CI                                                                                     | The person (new workflow)  |
| C   | `db:seed`, `db:backfill` and their workflows                                                                  | The person (new workflows) |
| D   | Playwright and its CI job, `pnpm work verify`, the observation window                                         | The person (new workflows) |

New checks live in `package.json` scripts (`check:pr`, `e2e`), so later changes do not need the person: each workflow only calls a script.

## A · `pnpm work` and planning

- `scripts/work/` with one entry and subcommands: help (no args: actions and the next step on a ticket branch), `status`, `resume`, `start`, `inbox`, `pr`, `close`; `verify` arrives in D. Every command takes `15` or `#15` (decided 2026-11-18), supports `--dry-run`, is safe to repeat, and fails with a clear message.
- Identity check before anything that writes: git author must be the noreply email in `project.yaml`; for `gh`, either `GH_TOKEN` is the agents' App (agents) or the logged-in user is `github.account` of `project.yaml` (person). Otherwise it refuses.
- `start`: refuses without a `size:` label; creates the branch with `gh issue develop` (`feature/<n>-<slug>`), `.work/PROGRESS.md`, and moves the card to Build (S) or Define (M, L).
- `pr`: runs `pnpm check`, turns `@wip` into `@issue`, posts the "Plan" comment if `.work/plan.md` exists, deletes the temporaries in one commit, pushes with the App token, opens the PR with its body (`PRD #`, `Ticket #`, labels), posts "Progress" and moves the card to Review.
- `close`: closes the issue with a comment and the proposed learning, if any.
- `inbox` and `status`: read issues, PRs, the board and `.work/PROGRESS.md` / "Progress" comments; `--json` for scripts.
- `plan:check` (dependencies, cycles, two tasks of one wave touching the same file), `plan:sync` (`.work/tasks.md` → issue checklist), `specs:ids` (`@id:<domain>-<issue>-<n>`), `test:new` (integration test template), `debt` (lists `paid-plan(...)` marks).
- Guides in `docs/procedures/`: `work.md`, `planning.md`, `living-specs.md`, `testing.md`, `critical-paths.md`.

## B · Traceability checks (ADR-0042, ADR-0030, ADR-0052)

One workflow job on `pull_request` (types opened, synchronize, reopened, edited, labeled, unlabeled) runs `pnpm check:pr`, which runs each check as a script in `scripts/checks/`. Values from the event go through `env:`, never interpolated into `run:`.

| Check              | Rule                                                                                                                                                                                                                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch             | `^(feature\|bugfix\|hotfix)/\d+-[a-z0-9-]+$`, the number an open issue; `renovate/*` exempt                                                                                                                                                                                                                                                 |
| Commits            | commitlint (conventional) plus a local rule: `Refs: #<branch ticket>` in every commit; Renovate exempt                                                                                                                                                                                                                                      |
| PR body and labels | `Ticket #N` (and `PRD #N` if the issue has a parent); `type:` and `area:` labels                                                                                                                                                                                                                                                            |
| Size               | the issue has `size:`; `size:L` if the diff touches a path of `docs/procedures/critical-paths.md`                                                                                                                                                                                                                                           |
| Temporaries        | no `.work/PROGRESS.md`, `.work/plan.md`, `.work/tasks.md`, no `@wip` in what reaches `master`                                                                                                                                                                                                                                               |
| Examples           | every `@id` in `docs/domains/` has a test that cites it, and no test cites a missing one; it also writes the "Verification" comment                                                                                                                                                                                                         |
| Acceptance order   | commits touching `e2e/acceptance/` come before any commit outside `docs/**` and the temporaries, per segment: each `/reopen-acceptance` of the person on the issue opens a new segment (decided 2026-11-18). The comment counts only if its author has `admin` permission on the repo, is a user (not a bot) and is not made through an app |
| Author             | every commit of the PR has the project's noreply email; Renovate exempt; the squash commit of `master` is not checked (PR #1)                                                                                                                                                                                                               |
| Emails in the diff | none except the noreply and the seed test domains                                                                                                                                                                                                                                                                                           |
| `paid-plan` marks  | format `paid-plan(<ADR>)`                                                                                                                                                                                                                                                                                                                   |
| Duplicated `.tsx`  | jscpd, warning only                                                                                                                                                                                                                                                                                                                         |

## C · Seeds and backfills (ADR-0044)

- `pnpm db:seed`: deterministic and idempotent data for both D1 databases. Local only by construction: it never takes an environment, a database name or `--remote` from the caller; it always runs `wrangler d1 execute global-local|shard-1-local --local`. A test checks that any production config makes it throw before running anything.
- Staging is reset only by `reset-stg.yml` (manual, Environment `stg`): it wipes and seeds the stg databases. It has no `prod` input at all.
- `pnpm db:backfill <name>`: batched, resumable; remotely only through `backfill.yml` (manual, the person approves the Environment). Guides `seeds.md`, `backfills.md`.
- There are no tables yet: the seed and backfill infrastructure ships with a no-op seed and an example backfill used by its own test.

## D · Playwright, `pnpm work verify`, observation window

- `@playwright/test` 1.65.1; `webServer` starts `wrangler dev --local` for `apps/api` with its own `--persist-to`, after migrations and seed; waits on `/health`. Browsers installed in CI, not cached (Playwright's advice). E2E is its own CI job and runs only when an app is affected (turbo `--affected --dry=json`); a skipped job counts as passing.
- `pnpm work verify <n>`: worktree of the branch, local reset with seed, starts the app, opens the browser, prints the test list from the verification package.
- **Observation window** (24 hours, decided 2026-11-17): an hourly scheduled workflow, not an AI agent (an agent would need a paid API key; zero spend). For each prod deploy older than 24 hours whose issue has no closing marker, it checks: new Sentry issues first seen in that release in `prod`; UptimeRobot uptime of the prod monitor; `/health` serves that SHA. Clean: it comments "Observation window clean" and closes the issue with `pnpm work close`. Not clean: it comments what it found and asks the person. A hidden marker in the comment makes it idempotent.

## Security

- **New credentials** (🧑, read-only, repository secrets because the scheduled job has no Environment):
  - `SENTRY_READ_TOKEN`: a Sentry Internal Integration with Issue & Event: Read only (the organization token we have cannot read issues).
  - `UPTIMEROBOT_READ_KEY`: UptimeRobot's read-only API key.
- Workflows keep minimal `permissions`, actions pinned by SHA, event values through `env:`.
- The `/reopen-acceptance` check requires admin permission, a human user and no app (any user can comment on a public repo).
- `db:seed` cannot reach production by construction; `reset-stg.yml` has no prod input; backfills need the person's approval on the Environment.
- `pnpm work` refuses to act under any identity other than the App or the project account.

## Risks

| Risk                                                                 | Mitigation                                                                          |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| A scheduled workflow is disabled after 60 days without repo activity | Noted in the deploy runbook; any merge reactivates it                               |
| Sentry search syntax for a release is not confirmed                  | First run checked by hand against a known release (78bfcff)                         |
| UptimeRobot read-only key on the Free plan is not confirmed          | If missing, the window uses `/health` and Sentry only and says so                   |
| Checks too strict block real PRs                                     | Each check has a test with a passing and a failing case; Renovate exemptions tested |

## Decisions to approve

1. The observation window is checked by a deterministic script, not an AI agent (zero spend).
2. Two new read-only secrets, created by the person: `SENTRY_READ_TOKEN` and `UPTIMEROBOT_READ_KEY`.
3. `db:seed` is local only; staging is seeded only by the manual `reset-stg.yml`, which cannot target prod.
4. Four PRs, in order A → B → C → D.

## Out of scope

The production build check against the fake login (ADR-0029): there is no SPA or login yet. Help and changelog generators (`docs:new`, `changelog:new`, `docs:screenshots`): they need the marketing app.
