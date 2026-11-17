---
status: accepted
date: 2026-11-10
---

# ADR-0034: PRDs, slicing and ticket format

## Context

One concept should be both the product document and the grouper of tickets. In a generic base almost every user story starts with "As an admin…" and the role adds little, so the user-story format is dropped.

## Decision

- **PRD instead of epic**: a single concept is both the product document and the grouper of tickets. What is global lives in the vision and all PRDs inherit it.
- **"Slicer" role** (`docs/agents/slicer.md`), level `max`. Slices on two levels: vision → PRDs (roadmap) and PRD → tickets. **Mediated debate** ([ADR-0021](0021-orchestrator-and-subagents.md)) in as many rounds as needed.
- **Cycle of a PRD**, before the cycle of each ticket:

| Step | Who | Result | Moment |
|---|---|---|---|
| P1. **Write PRD** | Researchers (+ UI/UX with a recommended navigable prototype, + security if it applies); debate with the person | Body of the `type:prd` issue | 🧑 Moment 1 ([ADR-0020](0020-ticket-lifecycle.md)): approve the PRD |
| P2. **Slice** | Slicer (story mapping) + orchestrator, UI/UX and security (Specify of each ticket) | Ticket map in the PRD's issue: value, size (S/M/L, [ADR-0052](0052-living-specs-only-and-flow-by-size.md)), dependencies, order; per ticket, intent and final numbered examples (E1, E2…) | 🧑 Moment 1 ([ADR-0020](0020-ticket-lifecycle.md)): approve the slicing and the examples of all tickets at once |
| P3. **Create tickets** | Orchestrator | Sub-issues with template, labels and dependencies | — |

- The PRD cycle has no branch or PR: the PRD is written and approved in the body of its issue, and its status goes in a "Progress" comment on that issue ([ADR-0016](0016-procedure-harness.md)). Decisions made while writing the PRD go in its sections (Requirements, Non-functional, Assumptions and risks…), not in a separate section.

- **PRD template** (issue body): Problem · Users · Hypothesis (optional) · Goals and metrics · Appetite (maximum scope) · Requirements · Non-functional (own) · Solution sketch · Assumptions and risks · Non-goals · Launch criteria · Tickets. Content in Spanish; headings in English.
- **Hypothesis and outcome review** (outcome-driven in its minimal version, [ADR-0052](0052-living-specs-only-and-flow-by-size.md)): optional hypothesis "We believe that [change] will make [users] [behavior]; we will know when [metric] reaches [threshold] in [period]". If the PRD has one, when closing it an "Outcome review" comment is added with the result and the decision (continue, adjust or withdraw); it feeds the roadmap. Without a hypothesis there is no review.
- **Slicer rules**: vertical slice (interface, API and data; something visible); **walking skeleton** first (minimal happy path end to end); patterns by flow step, from simple to complex, by data variation, by role, by operation; every ticket deployable on its own (behind a flag if needed) and INVEST; order by value and risk; `chore` only when no vertical slice is possible and justified. PRD requirements do not map one to one to tickets.
- **Ticket format: capability + examples**. The user story (as a / I want / so that) is discarded: in a generic base almost everything starts with "As an admin…" and the role adds little.
- **Examples in Gherkin** (`Given` / `When` / `Then`; BDD / Specification by Example practice), **without Cucumber**. They are the ticket's **acceptance criteria**: final and numbered in the issue (E1, E2…, approved at moment 1) → living spec on the branch with its final `@id` (`pnpm specs:ids`, [ADR-0052](0052-living-specs-only-and-flow-by-size.md)) → protected acceptance scenarios and failing tests (test designer, [ADR-0030](0030-test-designer.md)) → each with its test green in the matrix that CI generates ("Verification" comment).
- **Issue templates** (`.github/ISSUE_TEMPLATE/`, headings in English). All tickets carry an `area:` label (domain or support, [ADR-0024](0024-vision-domains-prds-and-tickets.md)):

| Type | Label | Sections |
|---|---|---|
| PRD | `type:prd` | PRD template (above) |
| Feature | `type:feature` | Capability · Value · Context (job story optional) · Intent · Examples (Gherkin, E1, E2…) · Out of scope · Depends on · Tasks. The size goes in the `size:` label ([ADR-0052](0052-living-specs-only-and-flow-by-size.md)) |
| Bug | `type:bug` | What happens · Expected (Gherkin → regression test) · Steps to reproduce · Environment · Severity ([ADR-0039](0039-operations-and-incidents.md)) · Evidence |
| Chore | `type:chore` | What · Why not vertical · Manual steps (🧑) · Done when (observable) |
| Spike | `type:spike` | Question · Timebox · Outcome (decision or ADR, not code) · Out of scope |

- **Source of truth by moment**: the approved examples in the issue (moment 1); on the branch, the diff of the living spec, which must match them. The issue keeps the capability, the intent and the task checklist.
- **Tasks in GitHub**: `pnpm plan:sync` writes `tasks.md` as a checklist in the issue. Only `tasks.md` → issue; nobody edits the checklist by hand. New Verify tasks are added to `tasks.md` and synced again. When the PR is opened, `tasks.md` is deleted ([ADR-0016](0016-procedure-harness.md)) and the checklist becomes the source: the orchestrator adds and ticks the review tasks there.
  - Status in the `Status` column of `tasks.md` (`todo` / `doing` / `done`), which the orchestrator updates when starting and when making the commit of each task.
  - Format in the issue (GitHub task list syntax: lowercase `[x]` and no extra spaces, or GitHub does not draw the checkbox or count progress):
    ```markdown
    - [x] T1 · Failing tests: invitations
    - [x] T2 · Migration: invitations table
    - [ ] T3 · POST /invitations endpoint · 🔄 in progress
    - [ ] T4 · Invitation email
    - [ ] T5 · "Invite member" screen
    ```
  - S tickets (no `tasks.md`): the issue's checklist is the source and the orchestrator ticks it directly with the same format.
- **Dependencies between tickets**: GitHub's native "blocked by" relation (available in Free, verified).
- **Definition of Ready** (`docs/process/definition-of-ready.md`): capability, value and at least one example; slicing of its PRD approved (if it has a PRD); dependencies resolved or planned; size confirmed (`size:` label, [ADR-0052](0052-living-specs-only-and-flow-by-size.md)).
- **Definition of Done** (`docs/process/definition-of-done.md`): clean observation window of the Release (includes `pnpm check`, Verify, Document, moment 2, Staging and moment 3).

## Consequences

- The user-story format is discarded.
- PRD requirements do not map one to one to tickets.

## More information

Related: [ADR-0024](0024-vision-domains-prds-and-tickets.md), [ADR-0030](0030-test-designer.md), [ADR-0052](0052-living-specs-only-and-flow-by-size.md).
