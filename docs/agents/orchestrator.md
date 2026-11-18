# Orchestrator

The main session, not a subagent. Why: [ADR-0021](../adr/0021-orchestrator-and-subagents.md), [ADR-0020](../adr/0020-ticket-lifecycle.md). Level: `max` ([routing](routing.md)).

## What it owns

- **The person**: only the orchestrator talks to them. Subagents never do, never talk to each other and never launch other subagents.
- **The three moments** (Ask, Check, Publish) and the **five mandatory stops**: [cycle](../process/cycle.md#the-persons-three-moments), [stops](../process/cycle.md#mandatory-stops). Between moments, stop only for one of the five; decide everything else and note it in one line under "Decisions made".
- **Its own steps**: Specify (final numbered examples E1, E2… in the issue), Pull request, Close ([cycle](../process/cycle.md#steps)). Until `pnpm work` exists, do by hand what its subcommands would do ([bootstrap exceptions](../adr/0035-technical-work-and-bootstrap-prd.md)).
- **The ticket size**: classify standalone tickets with a one-line reason; raise it when the work proves bigger; never lower it ([flow by size](../process/cycle.md#flow-by-size)).
- **The "No entra" list** ([ADR-0043](../adr/0043-public-repo.md)): check it before writing to the repo, an issue, a PR or a commit. A hit is stop 2. At moment 1, warn if the ticket activates the trigger to go private.
- **Artifacts**: everything that reaches GitHub (issue sections, comments, PRs, commits) is published by the orchestrator, including what read-only subagents return.

## State

- `.work/PROGRESS.md`: follow the [progress procedure](../procedures/progress.md). Update it at every step up to Document, at the end of each wave and always before stopping.
- **"Work log"**: one comment on the issue, edited in place: phase jumps, stops, findings, rounds and the verification package.
- `.work/tasks.md` ([template](../process/templates/tasks.md)): set `Status` to `doing` when a task starts and `done` when its commit is made.
- Issue checklist: synced from `.work/tasks.md` by hand until `pnpm plan:sync` exists, in the format of [ADR-0034](../adr/0034-prds-slicing-and-ticket-format.md). In S, tick it directly.
- Formats of headers, commits and trailers: [traceability](../procedures/traceability.md).

## Roles by size

PRD cycle ([ADR-0034](../adr/0034-prds-slicing-and-ticket-format.md)): researchers (P1), UI/UX designer with a navigable prototype when the PRD brings new interface (P1), security reviewer if it applies (P1), slicer (P2).

Ticket cycle ([ADR-0052](../adr/0052-living-specs-only-and-flow-by-size.md)):

| Step | Role | S | M | L / critical zone |
|---|---|---|---|---|
| 1. Discover | [researcher](researcher.md) | If facts are missing | If facts are missing | If facts are missing |
| 2. Specify | [ui-ux-designer](ui-ux-designer.md) | — | If it touches the interface or public pages | Same as M |
| 2. Specify | [security-reviewer](security-reviewer.md) | Hotfix on a critical-zone path | Critical zone or rendered company-written content | Yes |
| 3. Design | [planner](planner.md) (`.work/plan.md`) | — | — | Yes |
| 4. Tasks | [planner](planner.md) (`.work/tasks.md`) | — (issue checklist) | Yes | Yes |
| 4. Tasks | [test-designer](test-designer.md) | Hotfix on a critical-zone path | Yes | Yes |
| 5. Implement | [implementer](implementer.md) | Yes | Yes | Yes |
| 6. Verify | [spec-reviewer](spec-reviewer.md) | — | Yes | Yes |
| 6. Verify | [ui-ux-designer](ui-ux-designer.md) | — | If it designed in Specify | Same as M |
| 6. Verify | [security-reviewer](security-reviewer.md) | Same as Specify | Same as Specify | Yes |
| 6. Verify | [verifier](verifier.md) | Reduced package | Yes | Yes |
| 7. Document | [writer](writer.md) | If the change is visible | If the change is visible | If the change is visible |

The UI/UX designer is never skipped for a new complete flow or a new public page. When a conditional role is skipped, note why in "Decisions made".

## Waves

- Run the waves of `.work/tasks.md` in order; tasks marked `[P]` in parallel, one subagent per task. Parallel reading is free; parallel writing only as the waves allow.
- Before running, check dependencies, cycles and overlapping `Touches` by hand until `pnpm plan:check` exists. Hot spots always in sequence ([ADR-0020](../adr/0020-ticket-lifecycle.md)).
- After each wave: `pnpm check` green, then one commit per task, in task order, with the trailers of [traceability](../procedures/traceability.md). Subagents never commit.
- Commits touching `e2e/acceptance/` go before any commit touching another path; before them only `docs/**`, `.work/PROGRESS.md`, `.work/plan.md` and `.work/tasks.md` ([ADR-0030](../adr/0030-test-designer.md)).

## Brief

Every subagent gets a self-contained brief; it sees nothing else of the conversation. Read the role file first and choose the level with [routing](routing.md).

```text
Role: <role> · Level: <fast|standard|max>
Objective: <one or two sentences>
Files and ADRs: <paths to read; paths it may write; ADRs and docs that apply>
Done when: <observable criterion, e.g. "pnpm check green and T3 tests pass">
Do not touch: <paths and actions out of scope>
```

- Reviewers (spec, UI/UX, security) get the spec plus the diff (`git diff master...HEAD`), never the implementer's brief, reasoning or summary.
- The test designer gets the spec plus `.work/plan.md` or `.work/tasks.md`, never the implementation.

## Return

Every subagent answers in this shape:

```text
Status: done | blocked | failed
Summary: <what it did, a few lines>
Evidence: <commands run and their result, links>
Files touched: <paths, or "none">
Open questions: <or "none">
```

- Before accepting `done`, check the evidence (rerun `pnpm check` after a role that edits files).
- `failed` or `blocked`: [escalation](routing.md#escalation).
- Open questions: decide and note it, or ask the person if it is a mandatory stop.

## Loops

- **Implement ↔ Verify**: at most 3 rounds for failures against the spec, then stop 5. Every finding becomes a task before it is fixed. Classification and destinations: [loops](../process/cycle.md#loops).
- **PR review**: each CodeRabbit or CI comment is a Verify finding. Group the fixes of a round into one push.

## GitHub identity

Agents act on GitHub only as the GitHub App `workampo-agents` (`github.agentsApp` in [`project.yaml`](../../project.yaml)), never with the person's account or `gh` login ([ADR-0041](../adr/0041-agent-boundaries.md), [ADR-0064](../adr/0064-local-secrets.md)).

- [`scripts/github/app-token.mjs`](../../scripts/github/app-token.mjs) prints a 1-hour installation token. Ask for a new one when it expires; never print, log or store it.
  - `gh`: `GH_TOKEN=$(node scripts/github/app-token.mjs) gh pr create …`
  - Push: `git push "https://x-access-token:$(node scripts/github/app-token.mjs)@github.com/worKampo/workampo.git" <branch>`. Never save that URL as a remote.
- Commit author: the project's *noreply* identity (`github.commitEmail` in `project.yaml`), loaded per folder ([bootstrap](../process/bootstrap.md)). Check `git config user.email` before the first commit.
- Never read `~/.workampo/` (the App key).
- Cannot: merge to `master`, approve PRs or Environments, deploy to production, force push, write `/reopen-acceptance`.

## Without subagent support

Run the roles in sequence in this session: read `docs/agents/<role>.md`, work only inside that role's brief and limits, and write its return before moving on. As a reviewer, read only the spec and the diff, not the earlier implementation notes.
