# Procedure: `pnpm work`

One entry for the ticket cycle. Why: [ADR-0020](../adr/0020-ticket-lifecycle.md), [ADR-0052](../adr/0052-living-specs-only-and-flow-by-size.md). Code: [`scripts/work/work.mjs`](../../scripts/work/work.mjs).

Issue numbers are written `15` or `#15`; docs use the form without `#`. Commands that write take `--dry-run`, which prints what they would run, and are safe to repeat.

| Command | What |
|---|---|
| `pnpm work` | Help; on a ticket branch, also the "Next" line of its progress |
| `pnpm work status [n…] [--json]` | What is in progress; with numbers, the detail of those tickets |
| `pnpm work inbox [--json]` | Only what waits for the person: PRs to review, deployments to approve, tickets waiting on them |
| `pnpm work resume [n]` | Switch to the ticket's branch and print the reading order of [progress](progress.md); refuses with uncommitted changes |
| `pnpm work start <n>` | Refuses without a `size:` label. Creates the branch from an up-to-date `master` (`feature/<n>-<slug>`, or `bugfix/` for `type:bug`), never with `gh issue develop` ([ADR-0067](../adr/0067-ticket-branches-not-linked.md)), commits `.work/PROGRESS.md`, pushes, moves the card to Build (S) or Define (M, L) |
| `pnpm work pr [--title "<t>"] [--body-file <f>]` | On a ticket branch: runs `pnpm check`, turns `@wip(#n)` into `@issue(#n)`, removes `.work/` in one commit, pushes, opens the PR (`PRD #`, `Ticket #`, `type:` `area:` `size:` labels), posts the "Plan" and "Progress" comments, moves the card to Review |
| `pnpm work close <n> [--learning "<text>"]` | Closes the issue as completed with a comment (and the proposed learning), moves the card to Done. An unknown option fails; a learning that starts with `--` goes as `--learning=<text>` |
| `pnpm work verify <n>` | Local check of moment 2 ([verify](#verify)) |

## Identity

Everything that writes refuses to run unless:

- git's `user.email` is the project's noreply address ([bootstrap](../process/bootstrap.md)), and
- `GH_TOKEN` is an installation token of the agents' App for this repo (agents), or, with no `GH_TOKEN`, `gh` is logged in as the project account (the person). Without `GH_TOKEN`, `pnpm work` runs `gh` with its own config: the `GH_CONFIG_DIR` already set, or else `.config/gh-workampo` in the user's home as Node sees it (`%USERPROFILE%` on Windows), the folder of the bootstrap's `gh` shell functions, and it ignores `GITHUB_TOKEN`, which `gh` would prefer to that login. The machine's global `gh` account is never used nor switched. Without a login there, any command prints the exact login command for that folder; the one-time login is in [bootstrap](../process/bootstrap.md). The board warnings name the same folder for the person, and the App's Projects permission for the agents.

The error names the command that fixes each problem. Pushes with a token go to `https://github.com/<repo>.git`, never to a remote; the token travels as an HTTP header in the environment of that one `git push` (`GIT_CONFIG_*`), never in its arguments, a log or an error.

## What it reads

- `status`, `inbox` and `resume` take the progress from `.work/PROGRESS.md` or the PR's latest "Progress" comment.
- Only comments by the project account (a user) or `workampo-agents[bot]` (a bot) count: anyone can comment on a public repo, so a stranger's comment never reaches an agent.
- The board needs the `project` scope of `gh` (`gh auth refresh -s project`); without it, the commands warn and the card is moved by hand.

## Verify

`pnpm work verify <n>` prepares the person's local check of a ticket:

1. Refuses if the ticket has no branch, or if something already answers on `http://127.0.0.1:8787`.
2. Checks out the branch (from `origin` if it was pushed) detached in a worktree `C:\Dev\SaaS\workampo-verify-<n>`, next to the repo folder; it reuses that folder if it exists. The branch stays checked out in the main folder.
3. `pnpm install` there, builds the SPA (`apps/web/dist`, which the Worker serves), then a fresh local database: deletes `apps/api/.wrangler/verify`, applies the migrations and runs the seed. These steps and the app run the branch's own code, so they get no credentials: every `GH_*`, `GITHUB_*`, `BOARD_*`, `CLOUDFLARE_*`, `SENTRY_*` and `UPTIMEROBOT_*` variable, and any name with `TOKEN`, `SECRET`, `PASSWORD`, `PASSWD`, `CREDENTIAL`, `PRIVATE` or `_AUTH`, or ending in `_KEY`, in any case, is blanked. It is a deny list: an allow list would also cut the system variables pnpm and wrangler need on Windows.
4. Starts `wrangler dev` in the background on port 8787 (log: `apps/api/.wrangler/verify.log`), waits for `/health` and opens it in the browser.
5. Prints the verification list: the issue's "Work log" comment, or else the PR's latest "Progress" comment, only by trusted authors.

It prints the command that stops the server: `taskkill /PID <pid> /T /F` on Windows, `kill <pid>` elsewhere. Remove the folder when done with `git worktree remove ../workampo-verify-<n>`.

The observation window that closes tickets after the prod deploy is not part of `pnpm work`: [deploy runbook](../runbooks/deploy.md#release-observation-window).
