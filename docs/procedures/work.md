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
| `pnpm work review <pr> [--wait]` | Step 8 ([review](#review)): says whether CodeRabbit or CodeQL is still reviewing (`--wait` re-checks every 30 s, up to 20 min), then lists its unanswered threads and the findings of its latest review body, and the round |
| `pnpm work review <pr> --reply <id> --commit <sha> --text "<t>"` | Answers the thread "Fixed in <sha>: <t>"; refuses if the commit is not on the PR on GitHub. `--not-applicable "<reason>"` instead answers "Not applicable: <reason>" |

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
3. `pnpm install` there, builds the SPA (`apps/web/dist`, which the Worker serves), then a fresh local database: deletes `apps/api/.wrangler/verify`, applies the migrations and runs the seed. These steps and the app run the branch's own code, so they get no credential environment variables: every `GH_*`, `GITHUB_*`, `BOARD_*`, `CLOUDFLARE_*`, `SENTRY_*` and `UPTIMEROBOT_*` variable, and any name with `TOKEN`, `SECRET`, `PASSWORD`, `PASSWD`, `CREDENTIAL`, `PRIVATE` or `_AUTH`, or ending in `_KEY`, in any case, is blanked. It is a deny list: an allow list would also cut the system variables pnpm and wrangler need on Windows. Only environment variables are cleared: the processes can still read files the user can read, such as local credential stores.
4. Starts `wrangler dev` in the background on port 8787 (log: `apps/api/.wrangler/verify.log`), waits for `/health` and opens it in the browser.
5. Prints the verification list: the issue's "Work log" comment, or else the PR's latest "Progress" comment, only by trusted authors.

**`--keep-data`** keeps the database of the previous run, so a fix can be checked on the data already created: it skips the delete and the seed and applies only the migrations not yet applied. It keeps a database only if its seed finished (a `.seeded` mark written after the seed); otherwise, or with no previous database, it starts a fresh one. If a new migration does not apply to the kept data, it stops and says to run `verify` without `--keep-data`. The new code is the branch's pushed code, as always.

It prints the command that stops the server: `taskkill /PID <pid> /T /F` on Windows, `kill <pid>` elsewhere. Remove the folder when done with `git worktree remove ../workampo-verify-<n>`.

## Review

`pnpm work review <pr>` serves the review loop of step 8 ([cycle](../process/cycle.md#pr-review)):

- **Waiting**: it reads the check runs named `CodeRabbit` and `CodeQL` on the PR's head commit (or commit statuses of those names). Not completed counts as still reviewing; a missing `CodeRabbit` too, a missing `CodeQL` not (not every change runs it): without `--wait` it says so and exits 0; with `--wait` it re-checks every 30 s and fails after 20 minutes.
- **Listing**: only the reviewers' own comments count: CodeRabbit (`coderabbitai[bot]`), CodeQL (`github-advanced-security[bot]`) and the person's account; anyone else may comment on a public repo. A thread is listed until the agents' App replies, and again when the person replies after it, as `<id> <path>:<line> · <reviewer> · <severity> · <title>`. A new reviewer is one more entry in the reviewers list of `scripts/work/review.mjs`. From the latest CodeRabbit review body it lists each item of its sections ("Nitpick comments", "Outside diff range comments", "Minor comments"…) and the names of the failed pre-merge checks. The reviewers' prompts for agents, code blocks and HTML are never printed.
- **Round**: the number of CodeRabbit reviews on the PR; from the third it warns that what is left goes to an issue with a milestone.
- **Replying**: `--reply` with `--commit` posts only if the sha (7 to 40 hex) starts one of the PR's commits on GitHub, so a reply never cites a commit that failed or was not pushed. It never resolves the thread. `--dry-run` prints the reply instead.

The observation window that closes tickets after the prod deploy is not part of `pnpm work`: [deploy runbook](../runbooks/deploy.md#release-observation-window).
