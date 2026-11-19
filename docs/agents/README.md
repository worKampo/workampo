# Agents

Roles of the ticket cycle ([ADR-0021](../adr/0021-orchestrator-and-subagents.md)); the cycle itself is in [cycle](../process/cycle.md). These files are the source of truth; `.claude/agents/<role>.md` only points here.

| File | What it is |
|---|---|
| [orchestrator](orchestrator.md) | The main session: talks to the person, owns moments, stops, loops, `.work/PROGRESS.md`, waves and briefs |
| [routing](routing.md) | Levels, models, effort and escalation; the only file that names models |
| [slicer](slicer.md) | Slices the vision into PRDs and a PRD into tickets with examples |
| [researcher](researcher.md) | Finds the facts an intent or PRD needs, with sources |
| [ui-ux-designer](ui-ux-designer.md) | Designs flow and states in Specify; reviews the interface in Verify |
| [planner](planner.md) | Writes the content of `.work/plan.md` (L) and `.work/tasks.md` (M, L) |
| [test-designer](test-designer.md) | Writes the living-spec diff, failing tests and protected acceptance scenarios before any code |
| [implementer](implementer.md) | Implements one task with TDD |
| [writer](writer.md) | Document step: living-spec coverage, help, changelog, screenshots |
| [spec-reviewer](spec-reviewer.md) | Checks that spec, scenarios and diff match the approved examples |
| [security-reviewer](security-reviewer.md) | Threat model in Specify; reviews the diff against it in Verify |
| [verifier](verifier.md) | Explores the change locally and prepares the verification package |

## Tools

Every role ([ADR-0058](../adr/0058-agent-and-repo-tooling.md)):

- **Documentation** before using an external API, always for the version installed in the repo (`package.json`, `pnpm-lock.yaml`), in this order:
  1. The vendor's official source or its `llms.txt`.
  2. Context7: `npx ctx7@latest library <name> "<question>"`, then `npx ctx7@latest docs <id> "<question>"`.
  3. Web search.
- **`gh` CLI** for issues, PRs and CI, with the agents' GitHub App token ([GitHub identity](orchestrator.md#github-identity)).
- **Read-only** except implementer, test designer and writer. In read-only roles, Bash runs only commands that change nothing: `gh` reads, `git log`, `git diff`, `pnpm check`.
- Never secrets or customer data in a query ([ADR-0043](../adr/0043-public-repo.md)).
