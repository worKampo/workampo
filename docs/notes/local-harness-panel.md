# Local harness panel

> Status: deferred, from decision D61 of the former decisions log. Proposal for the future (2026-11-14), not part of the PRD "Working foundation". Until then: `pnpm work inbox` and the "Waiting on" field of the board ([ADR-0037](../adr/0037-roadmap-board-and-wip-limit.md), [ADR-0052](../adr/0052-living-specs-only-and-flow-by-size.md)). It is picked up when several tickets run in parallel or it gets hard to see what is where.

- **What it is**: `pnpm work ui`, a **local-only** page started with one command. It reads the same sources as `pnpm work` (`gh`, repo files, the `/health` of each Worker, `pnpm work status --json`) and is never deployed. A simple page served by the script itself, with no build and no new dependencies.
- **Where it is seen** (2026-11-14): the command starts a Node server in `scripts/work/` and opens the browser at `http://127.0.0.1:<port>/?t=<token>`; it exists while the terminal stays open. The port is configurable in `project.yaml` ([ADR-0045](../adr/0045-project-profile.md)). It can also be opened in the browser panel of the Claude app. It is not visible from a phone: for that, use the GitHub board filtered by "Waiting on". On another machine ([multiple machines note](multiple-machines.md)) it is the same command, with nothing to sync.
- **Local security**: it listens only on `127.0.0.1`, never on `0.0.0.0`; a random token is generated at startup and required on every request; actions go through `POST` with that token, and the server rejects requests with a `Host` header different from its own. This way no web page open in the browser can launch commands by calling `localhost`.
- **Blocks**:

| Block | What it shows |
|---|---|
| Waiting on you | What `pnpm work inbox` shows: pending moments 1, 2 and 3 and open mandatory stops |
| In progress | Tickets with size, step, last "Work log" entry and blockers |
| Environments | SHA of each Worker in staging and production, last deployment and smoke result |
| CI | Latest runs and their duration against the target in [ADR-0013](../adr/0013-ci-cd-with-github-actions.md) |
| Process health | Metrics from [ADR-0040](../adr/0040-process-metrics-and-monthly-review.md) |
| Debt and warnings | `paid-plan` marks ([ADR-0056](../adr/0056-async-work.md)), size of `learnings.md`, pending ⚠ checks |
| Configuration, read-only | Declared labels, rulesets and Environments against the real ones in GitHub: warns if someone changed something by hand |

- **"History" view** (what was done; 2026-11-14):

| View | What it shows | Where it comes from |
|---|---|---|
| By PRD | Tickets, PRs, versions in production (SHA and date), "Outcome review" if it had a hypothesis, and the learnings it left | Sub-issues, PRs, "Release verification" and "Outcome review" comments ([ADR-0034](../adr/0034-prds-slicing-and-ticket-format.md)) |
| By spec rule | Why the rule is the way it is: the issues that changed it, with their intent and approved examples | `@issue(#n)` and `git log` of `docs/domains/` ([ADR-0042](../adr/0042-traceability.md), [ADR-0052](../adr/0052-living-specs-only-and-flow-by-size.md)) |
| Timeline | Deployments, decisions (ADRs) and learnings by date | Deployment workflow, `docs/adr/`, `docs/learnings.md` |
| How the process went | Per ticket: size, rounds, stops and time of each moment | "Work log" comments ([ADR-0040](../adr/0040-process-metrics-and-monthly-review.md)) |

- **"Ready" view** (what comes next): roadmap by PRD with its progress; tickets that meet the Definition of Ready against those that do not, and why; what is deferred and the Backlog checks.
- Both are read-only, are computed from GitHub and git with a local cache (so as not to exhaust the API limit) and store nothing new. They make sense once several PRDs are closed. If the living documentation of [ADR-0052](../adr/0052-living-specs-only-and-flow-by-size.md) is set up, each rule can also link to the issues that changed it.

- **It can**: open the verification package, run `pnpm work verify #n`, run read-only commands or commands with `--dry-run`, and open the corresponding file or issue.
- **It cannot**: merge, approve PRs or approve production (it only links to GitHub); change rulesets, Environments or secrets (scripts the person runs with their own token, [ADR-0041](../adr/0041-agent-boundaries.md)); edit configuration (it is code and goes through a PR). It runs with the project's `gh`, the same one agents can use: if the panel could approve, an agent could too.
- **Different from "System health"** in the backoffice ([ADR-0039](../adr/0039-operations-and-incidents.md)): that one shows production health to the staff; this one is a development tool and never leaves the machine.
