---
status: accepted
date: 2026-11-14
---

# ADR-0020: Ticket lifecycle

## Context

Inspired by spec-driven development (GitHub Spec Kit, Kiro): **spec → plan → tasks → implement**. The person defines and checks results; they do not review all the code.

## Decision

Revised 2026-11-14: **the person intervenes at three moments**, the same for all sizes; between them the agent works alone and stops only in the cases of the closed list of "Mandatory stops".

| Moment 🧑 | When | What the person does | What they receive |
|---|---|---|---|
| **1. Ask** | PRD and slicing ([ADR-0034](0034-prds-slicing-and-ticket-format.md)); for standalone tickets, when creating the issue | Talks with the agent until everything is concrete. Approves the list of tickets with their size and **the examples of all the tickets at once** | PRD, tickets and, per ticket, intent and numbered Gherkin examples (E1, E2…), plus the UI section (with its level and, from level 2, mockup and screenshots, [ADR-0031](0031-ui-ux-designer.md)) if it applies and the Security section in L and critical zones |
| **2. Check** | PR open, CI green and reviews addressed | Follows the test list locally (`pnpm work verify #n`) and, if they want, looks at the code pointed out. Approves the PR (merge) or returns findings | Verification package in the "Work log" comment of the issue |
| **3. Publish** | Staging smoke green | Tests in staging only what is marked "Only verifiable in staging" and promotes to production | "Staging verification" comment and release summary |

The eleven named steps still exist for the agent. The table is the full path (L and critical zones); S and M shorten it ("Path by size"):

| Stage | Step | Responsible | Artifact | Control |
|---|---|---|---|---|
| **Define** | 1. **Discover** | Researchers in parallel; in a PRD, the slicer ([ADR-0034](0034-prds-slicing-and-ticket-format.md)) | Intent in the issue body: Problem · Proposed outcome · Affected users and systems · Constraints · Open questions · Agreements (format of Anthropic's AI-native SDLC playbook, plus the agreements) | 🧑 Moment 1 |
| | 2. **Specify** | Orchestrator (+ UI/UX and security if applicable) | Final numbered Gherkin examples (E1, E2…) in the issue; UI section ([ADR-0031](0031-ui-ux-designer.md)) and, in L and critical zones, Security section ([ADR-0032](0032-security-reviewer.md)) in the issue | 🧑 Moment 1 |
| | 3. **Design** | Planner (L only) | `plan.md` (temporary on the branch): data model, API contracts, migrations, flags, analytics events, risks | Automatic reviewers; what is relevant moves to "Decisions made" |
| | 4. **Tasks** | Planner + test designer ([ADR-0030](0030-test-designer.md)) | Living-spec diff on the branch (`@wip(#n)`) with the approved examples and their final `@id` (`pnpm specs:ids`, [ADR-0052](0052-living-specs-only-and-flow-by-size.md)); **protected acceptance scenarios** ([ADR-0030](0030-test-designer.md)); `tasks.md` with the failing tests (`it.fails`) as the first wave | `pnpm plan:check`; the spec reviewer checks that the spec and the scenarios contain exactly the approved examples |
| **Build** | 5. **Implement** | Implementers (TDD, one commit per task, waves) | commits | `pnpm check` green per wave ("Failing tests", below) |
| | 6. **Verify** | Spec reviewer; UI/UX and security if applicable; verifier | Findings and rounds in the "Work log" comment; the verifier explores locally and prepares the verification package | Loop of up to 3 rounds |
| | 7. **Document** | Writer | Help ([ADR-0025](0025-user-help-with-starlight.md)), changelog ([ADR-0026](0026-user-changelog.md)) and screenshots ([ADR-0028](0028-images-in-documentation.md)) when the change is visible | The orchestrator decides with those rules and notes it in the package |
| **Deliver** | 8. **Pull request** | Orchestrator with `pnpm work pr`; CI generates "Verification"; CodeRabbit reviews | PR | CI green and comments addressed → 🧑 Moment 2 |
| | 9. **Staging** | Automatic deploy, migrations, smoke | "Staging verification" comment in the issue | 🧑 Moment 3 |
| | 10. **Release** | Deploy to production, read-only smoke, observation window of the verifier | "Release verification" comment in the issue | Automatic: clean window → Close; otherwise [ADR-0039](0039-operations-and-incidents.md) |
| **Learn** | 11. **Close** | Orchestrator with `pnpm work close`, no questions | Issue closed; ADRs and glossary; proposed learning in the closing comment if there is one | — |

**Cycle rules**
- **Mandatory stops**: between the moments, the agent stops and asks the person only if:
  1. **Ambiguity that changes behavior**: the examples do not cover a case and there are two reasonable answers with different results for the user; or the implementation contradicts an approved example or the approved design ([ADR-0031](0031-ui-ux-designer.md)).
  2. **Something irreversible**: the contract step of a migration ([ADR-0033](0033-expand-contract-migrations.md)), deleting data, changing an API contract that is already in use ([ADR-0041](0041-agent-boundaries.md)) or publishing something from the "No entra" list of the public repo ([ADR-0043](0043-public-repo.md)).
  3. **New cost or provider**: a provider dependency ([ADR-0053](0053-code-conventions.md)) or a paid service.
  4. **Uncovered critical zone**: session, isolation, billing or secrets, when the spec says nothing.
  5. **Stuck**: after 3 rounds of the Implement ↔ Verify loop, or when its attempt budget runs out; it stops with a report (where it is blocked and what it tried).

  Everything else is decided by the agent and noted in "Decisions made" of the verification package.
- **Verification package** (published by the orchestrator in the "Work log" comment on reaching moment 2):
  1. How to start it: `pnpm work verify #n` creates the worktree of the branch, resets the local database with the seed, starts the app and opens the browser.
  2. **Test list** taken from the examples, with the seed accounts ("log in as Ana, admin of Northwind; go to Members; try to remove Marc: it asks for DELETE").
  3. What was already checked automatically: tests, examples matrix, axe, screenshots on desktop, mobile and dark, Playwright videos of the flows.
  4. **Decisions made**, one line each.
  5. What was not done or could not be checked, and what is marked **"Only verifiable in staging"** (real login, real emails, payments in test mode, real mobile, performance).
  6. **Code worth looking at**: 2 to 5 places with the reason (permissions, queries with `tenant_id`, migrations), not the whole diff.

  If the test list turns out long, the ticket was too big: the slicer cuts finer and it becomes a learning.
- **Environments**: locally, it is checked that it does what was asked (isolated branch, seed, fake login, captured emails, fake services); in staging, that it works on the real platform with real services ([ADR-0044](0044-migrations-reference-data-seeds-and-backfills.md)). Acceptance is done locally because rejecting there does not touch `master`.
- **Path by size**: the three moments are the same; the size decides which steps and how much automatic review there is. Table and rules in [ADR-0052](0052-living-specs-only-and-flow-by-size.md).
- **Examples frozen from moment 1**: if the implementation or the person's check contradict them, it is stop 1: the person approves the affected examples again and their scenarios are reopened ([ADR-0030](0030-test-designer.md)). After the merge, the living spec stays in `master` and the change in the git and PR history.
- **Current state** ([ADR-0016](0016-procedure-harness.md)): `PROGRESS.md` until Document; "Progress" comment of the PR during review; issue comments in Staging and Release.
- **PR review (step 8)**: each CodeRabbit or CI comment is classified as a Verify finding: failure or adjustment → new checkbox in the issue checklist → Implement → Verify; scope change → new issue. The agent resolves it before moment 2.
- **Implement ↔ Verify loop**: maximum 3 iterations for failures against the spec; after that, stop 5. Rounds opened by the person at moment 2 do not count, but they are recorded in the "Work log" comment.
- **Failing tests**: the unit and integration tests of the first wave are committed as expected failures (Vitest `it.fails`), so `pnpm check` and pre-commit stay green; the implementer removes the mark when implementing. Acceptance scenarios (`e2e/acceptance/`, [ADR-0030](0030-test-designer.md)) do not run in pre-commit nor count for the per-wave green; they must be green in `pnpm work pr` and in CI.
- **UI and Security**: the UI/UX designer (states and flow; M and L) and the security reviewer (threat model; L and critical zones) write their sections in Specify, before moment 1, in the issue next to the intent. In Design (L only), `plan.md` collects only the technical items that follow from them (e.g. headers, validations); they do not reopen the spec.
- **Several tickets at once**: the agent can carry several in parallel worktrees within the work-in-progress limit ([ADR-0037](0037-roadmap-board-and-wip-limit.md)); the person checks them in batches.
- **Format of `tasks.md`**:
  ```markdown
  | ID | Task                               | Depends on | Touches                                                                          | Size | Level    | Status |
  |----|------------------------------------|------------|----------------------------------------------------------------------------------|------|----------|--------|
  | T1 | Failing tests: invitations         | —          | apps/api/src/companies/invitations/*.test.ts                                     | S    | max      | done   |
  | T2 | Migration: invitations table       | —          | packages/db/migrations/global/                                                   | S    | max      | done   |
  | T3 | POST /invitations endpoint         | T1, T2     | apps/api/src/companies/invitations/invite-member.ts, packages/domain/companies/invitations/ | M    | standard | doing  |
  | T4 | Invitation email                   | T2         | apps/api/src/companies/invitations/invitation-email.tsx                          | S    | standard | todo   |
  | T5 | "Invite member" screen             | T3         | apps/web/src/companies/members/                                                  | M    | standard | todo   |

  Waves: 1 → T1 [P] T2 · 2 → T3 [P] T4 · 3 → T5
  ```
  - Two tasks run in parallel (`[P]`) only if they do not depend on each other and do not touch the same files.
  - **Hot spots always in sequence**: migrations, `package.json` and lockfile, central route registry, shared configuration.
  - With disjoint files, the implementers work on the same branch and the orchestrator makes the commits in order; if more isolation is needed, worktrees integrated before the next wave.
  - `pnpm plan:check` validates dependencies, cycles and overlaps.
- **Verify (step 6) and findings of moment 2**: the verifier prepares the local test (`wrangler dev` + `pnpm db:seed`) and explores before the person. Each finding, from the agent or from the person, is classified:

| Type | Example | Destination |
|---|---|---|
| Failure | Does not meet an approved example | New task (in `tasks.md` or, with the PR open, in the issue checklist) → Implement → Verify → new package |
| Adjustment within scope | Text, order of fields, a state that looks wrong | Same (if UI, the UI/UX designer validates) |
| Scope change | Something the examples did not contemplate | Back to moment 1 (examples approved again) or a new issue if not essential |

  Nothing is fixed without a task.
- **Document (step 7)**: everything that must go in the same PR as the code is done here. It is checked that the living-spec diff covers all the changed behavior ([ADR-0024](0024-vision-domains-prds-and-tickets.md)). Help ([ADR-0025](0025-user-help-with-starlight.md)), changelog ([ADR-0026](0026-user-changelog.md)) and screenshots ([ADR-0028](0028-images-in-documentation.md)) are conditional: the orchestrator decides whether the change is visible with those rules and notes it in the package; the person can correct it at moment 2.
- **Staging and Release (steps 9 and 10)**: the code is already in `master`, so nothing goes back to the ticket branch. Findings are recorded as a comment in the issue:

| Type | In Staging | In Release |
|---|---|---|
| Serious failure | Revert in `master` if it is not fixed right away → `bugfix/` → full cycle → Staging. It is not promoted meanwhile | Turn the flag off if there is one; otherwise, Worker rollback → `hotfix/` (confirmed by the person; severity per [ADR-0039](0039-operations-and-incidents.md)) |
| Minor failure / adjustment | The person decides: it blocks the promotion (`bugfix/` before production) or not (new issue) | New `bugfix/` issue, normal cycle |
| Scope change | New issue | New issue |
| Environment failure | The configuration is fixed without touching code and noted in the runbook | Same |

  - Observation window in Release: a scheduled check launches the verifier, which reviews new errors in Sentry, Worker metrics and SLOs ([ADR-0039](0039-operations-and-incidents.md)). If it comes out clean, the ticket moves to Close without intervention; if not, the person is notified and the table is followed. Duration set in the deploy runbook.
  - The ticket moves to Close only when the observation window of its Release comes out clean; `pnpm work close` closes it without asking.
- **Bootstrap**: until the pieces of the "Working foundation" PRD exist (issues, CI, GitHub App, `pnpm work`, `plan:sync`), its tickets apply the cycle with the exceptions of [ADR-0035](0035-technical-work-and-bootstrap-prd.md). See the [bootstrap](../process/bootstrap.md).
- **Log**: in all sizes, phase jumps, stops, findings, rounds and the verification package are recorded in a single **"Work log"** comment of the issue, which the orchestrator edits (like "Progress"); the example ↔ test matrix is generated by CI in the "Verification" comment of the PR ([ADR-0052](0052-living-specs-only-and-flow-by-size.md)).

## Updates

- 2026-11-18: `pnpm work` takes the issue number as `15` or `#15`; docs use the form without `#` (decided in issue #27).

## Consequences

- Nothing is fixed without a task.
- Rounds opened by the person at moment 2 do not count toward the Implement ↔ Verify limit of 3.
- If the test list turns out long, the ticket was too big: the slicer cuts finer and it becomes a learning.
