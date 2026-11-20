# Procedure: traceability formats

Exact formats so every piece can be navigated in both directions. Why: [ADR-0042](../adr/0042-traceability.md).

## Identifiers

- Universal identifier: the GitHub issue number. PRD `#12`, ticket `#15`, task `#15/T3`. No other numbering.
- In text, **with a space**: `PRD #12`, `Ticket #15`. In trailers: `PRD: #12`, `Refs: #15`.
- Issue titles: PRDs carry the prefix `[PRD] Team`; tickets do not.
- **Never `Closes #n`** in commits or PRs: the ticket is closed in Close, after the observation window ([ADR-0020](../adr/0020-ticket-lifecycle.md)). Use `Refs:`.

## Formats by piece

| Piece | Format |
|---|---|
| Ticket ↔ PRD | Native GitHub sub-issue |
| Branch | Created from `master` by `pnpm work start`, never with `gh issue develop` ([ADR-0067](../adr/0067-ticket-branches-not-linked.md)); name matches `^(feature\|bugfix\|hotfix)/\d+-[a-z0-9-]+$`, e.g. `feature/15-invite-by-email` |
| Task commit | Conventional commit + trailers `Refs: #15` · `PRD: #12` · `Task: T3`, e.g. `feat(members): add POST /invitations` |
| Reopened acceptance commit | Also the trailer `Reopen: <comment-id>`, the id of the person's `/reopen-acceptance` comment on the issue ([testing](testing.md#acceptance-scenarios)) |
| PR title | Conventional commit |
| PR body | `PRD #12` and `Ticket #15` (PRD only if the ticket has a parent); filled by `pnpm work pr`. Same `type:` and `area:` labels as the ticket. "Plan", "Progress" and "Verification" are comments |
| Commit on `master` (squash) | PR title + the PR number GitHub adds, e.g. `feat(members): invite members by email (#40)`; body with the trailers |
| Living spec | One tag per `Rule:`: `@wip(#n)` on the branch, `@issue(#n)` on `master` (last issue that changed it) ([ADR-0052](../adr/0052-living-specs-only-and-flow-by-size.md)) |
| Example ↔ test | `@id:<domain>-<issue>-<n>` (e.g. `@id:companies-15-1`), assigned by `pnpm specs:ids`, cited by its test |
| ADR | Frontmatter `related: [12, 15]` |
| Help and changelog | Frontmatter not visible to the user: `ticket: 15` |
| Migration | Header `-- ticket: #15` |
| Feature flag | Registry entry with `ticket: 15` |
| `.work/PROGRESS.md` / "Progress" comment | Header `PRD #12 · Ticket #15 · Branch: …` ([progress](progress.md)) |
| Deployment | Worker version message and Sentry release = commit SHA: `wrangler deploy --message "#40 a1b2c3d"` |
| Incident | `sev:*` issue: `Caused by #40` · `Fixed by #52` |

## Code comments

No ticket references (`git blame` → commit → PR → issue leads there). Exceptions: `TODO` always with its issue; `paid-plan(<decision>)` with its decision ([ADR-0056](../adr/0056-async-work.md)).

## Versions

No hand-written version constants: the version is the commit SHA; the `version` field of `package.json` is not used ([ADR-0059](../adr/0059-web-client-version.md)).

## CI checks

Run in CI on every PR (`.github/workflows/traceability.yml`) by `pnpm check:pr`, one script per check in [`scripts/checks/`](../../scripts/checks/pr.mjs). Locally they need the PR's environment variables, so they run in CI only.

| Check | Rule |
|---|---|
| Branch | Name matches the regex and the number is an open issue |
| Commits | commitlint: conventional commit and `Refs: #<ticket of the branch>` in every commit, and no other `Refs:` (a merge with no Worker affected closes every ticket it names, #46) |
| PR body and labels | `Ticket #N` (and `PRD #N` if the ticket has a parent); `type:` and `area:` labels |
| Size | `size:` label on the issue; `size:L` if the diff touches a path of [critical-paths](critical-paths.md) |
| Temporaries | No `@wip`, `.work/PROGRESS.md`, `.work/plan.md` or `.work/tasks.md` in what reaches `master` |
| Examples | Every living-spec example has a test (by `@id`) and no test cites a missing example; CI then publishes the "Verification" comment |
| Acceptance order | In topological order, never by date: commits touching `e2e/acceptance/` come before the first code commit; a later one needs a `Reopen: <comment-id>` trailer naming an unused `/reopen-acceptance` comment by an admin user on the issue ([testing](testing.md#acceptance-scenarios)) |
| Author | Every commit has the project's *noreply* email (see the [bootstrap](../process/bootstrap.md)) |
| Emails in the diff | None except the noreply and the seed test domains |
| `paid-plan` marks | Format `paid-plan(<ADR>)` |
| Duplicated `.tsx` | jscpd; warning only |

### Learned in practice

- **Renovate**: branches `renovate/*` and the Renovate App identity are excluded from the branch-name and author checks.
- **Author check in squash merges**: GitHub sets the `master` commit author to whoever opened the PR, so the check looks at the PR's commits, not at the resulting `master` commit.
