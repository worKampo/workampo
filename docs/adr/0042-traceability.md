---
status: accepted
date: 2026-11-13
---

# ADR-0042: Traceability between pieces

## Context

Every piece of work (PRD, ticket, task, branch, PR, commit, spec, deployment, incident) must be navigable in both directions.

## Decision

- **Universal identifier**: the GitHub issue number. PRD `#12`, ticket `#15`, task `#15/T3`. All pieces carry the identifiers of their parents so they can be navigated in both directions. There is no other numbering (the roadmap names PRDs by title).
- **Text format**: `PRD #12` and `Ticket #15`, **with a space**, so the type reads and GitHub still links `#12`. In trailers: `PRD: #12`, `Refs: #15`.
- **Issue titles**: PRDs carry a prefix, `[PRD] Team`; tickets do not (their type is in the label and their PRD in the sub-issue relation).

| Piece | How it is related | Example |
|---|---|---|
| Ticket ↔ PRD | Native GitHub sub-issue | `#15` child of `#12` |
| Branch | Created from `master` by `pnpm work start` and named with the ticket; never linked with `gh issue develop`, because GitHub closes an issue when its linked branch is merged, before the observation window ([ADR-0020](0020-ticket-lifecycle.md); changed on 2026-11-19 after #39 and #43 closed at their merge) | `feature/15-invite-by-email` |
| Task commit | Conventional commit + trailers | `feat(members): add POST /invitations` · `Refs: #15` · `PRD: #12` · `Task: T3` |
| PR | Conventional title; body with PRD and ticket (filled by `pnpm work pr`); "Plan" (if there is a `plan.md`) and "Verification" (CI) comments; same `type:` and `area:` labels as the ticket; linked to the issue by the branch | `PRD #12` · `Ticket #15` |
| Commit on `master` (squash) | PR title + the PR number GitHub adds; body with trailers | `feat(members): invite members by email (#40)` · `Refs: #15` · `PRD: #12` |
| Living spec | Gherkin tag per rule (`Rule:`): `@wip(#n)` on the branch; `@issue(#n)` on `master`, the last issue that changed it ([ADR-0052](0052-living-specs-only-and-flow-by-size.md)) | `@issue(#15)` |
| Example ↔ test | Stable identifier of the example (`pnpm specs:ids`), cited by its test | `@id:companies-15-1` |
| ADR | `related:` frontmatter | `related: [12, 15]` |
| Help and changelog | Frontmatter not visible to the user | `ticket: 15` |
| Migration | Header | `-- ticket: #15` |
| Feature flag | Flag registry entry with its ticket, to know when to remove it | `ticket: 15` |
| `PROGRESS.md` / "Progress" comment | Header | `PRD #12 · Ticket #15 · Branch: …` |
| Deployment | Worker version message and Sentry release = commit SHA | `wrangler deploy --message "#40 a1b2c3d"` |
| Incident | `sev:*` issue linking the causing PR and the fix tickets | `Caused by #40` · `Fixed by #52` |

- **Never "Closes #15"** in commits or PRs: it would close the ticket on merge, and the ticket is closed in Close, after a clean observation window ([ADR-0020](0020-ticket-lifecycle.md)). Use `Refs:` and the orchestrator closes the issue.
- **No ticket references in code comments**: `git blame` → commit → PR → issue already leads there. Exceptions: `TODO` always with its issue; `paid-plan(<decision>)` with its decision ([ADR-0056](0056-async-work.md)).
- **CI checks it** (it breaks the PR if something is missing):
  - Branch name `^(feature|bugfix|hotfix)/\d+-[a-z0-9-]+$` and the number must be an open issue.
  - commitlint: conventional commit and a `Refs: #<ticket of the branch>` trailer in every commit.
  - PR body with `Ticket #N` (and `PRD #N` if the ticket has a parent) and `type:` and `area:` labels.
  - No `@wip` and no temporary files (`PROGRESS.md`, `plan.md`, `tasks.md`) in what reaches `master` ([ADR-0052](0052-living-specs-only-and-flow-by-size.md)).
  - `size:` label on the issue, and `size:L` if the diff touches critical-zone paths ([ADR-0052](0052-living-specs-only-and-flow-by-size.md)).
  - Author of every commit with the *noreply* email of the project account: never another account (see the [bootstrap](../process/bootstrap.md)).
  - Every example of the living specs has a test (by `@id`) and there are no tests of examples that no longer exist; with that, CI publishes the "Verification" comment.
- **No hand-written version constants** (2026-11-13): the version of each deployment is the commit SHA (in `/health` and in Sentry); the web client also compares the hash of the SPA build ([ADR-0059](0059-web-client-version.md)). The `version` fields of `package.json` are not used.
- **Resulting navigation**: PRD → tickets (sub-issues) → branch and PR (*Development*) → commit on `master` → deployed version and Sentry release; and the other way round, from an error in Sentry or a line of code to the PRD that motivated it.
- Procedure `docs/procedures/traceability.md` with the exact formats; `pnpm work`, `pnpm plan:sync` and the issue and PR templates fill them in automatically.

## Consequences

See Decision.
