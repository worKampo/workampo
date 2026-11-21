---
status: accepted
date: 2026-11-14
---

# ADR-0058: Agent and repo tooling

## Context

Agents need current documentation before using an external API. The repo is public ([ADR-0043](0043-public-repo.md)), so GitHub and pnpm security and dependency tools are free.

## Decision

**Decision** (2026-11-14): agents consult current documentation before using an external API, with tools assigned by role and read-only. The repo uses the free GitHub and pnpm tools for security and dependencies.

- **Order for consulting documentation**: 1) the provider's official source (its MCP or its `llms.txt`); 2) Context7; 3) web search. Always with the version installed in the repo. Context7 is an aggregator: useful as a fallback, with variable coverage and freshness and with a quota.
- **Tools by role**:

| Tool | Used for | Roles |
|---|---|---|
| Official Cloudflare MCPs (documentation, observability, builds) | Workers, D1 and Workflows documentation; logs and metrics in the observation window ([ADR-0020](0020-ticket-lifecycle.md)) | Researcher, verifier |
| Sentry MCP | Errors after the release; context of a bug | Verifier; implementer on bugs |
| Stripe (MCP or documentation) | Checkout, Portal and webhooks; data in test mode | Researcher; implementer on `billing` |
| shadcn MCP (official) | Explore and install registry components in `packages/ui`, respecting `components.md` | UI implementer |
| Playwright MCP | Explore the app locally and on staging; prepare the verification package | Verifier, UI/UX |
| Chrome DevTools MCP | Performance, console and network of a real page | Verifier, when there are performance doubts |
| DeepWiki or GitMCP | Questions about the code of a public repo (Hono, Drizzle, WorkOS SDK) when the documentation is not enough | Researcher (optional) |
| `llms.txt` of Hono and Drizzle | Full documentation without an intermediary | All |
| `gh` CLI | Issues, PRs and CI; uses less context than the GitHub MCP | All |

  - WorkOS has official MCPs (issue 23), but none is adopted: its documentation comes through Context7, with its `llms.txt` and `.md` pages as the fallback. Its management MCP writes to the account and signs in as the person, so it stays out ([ADR-0041](0041-agent-boundaries.md)).
  - **Per role**: each MCP takes up context with the definition of its tools; they are configured in each role's definition (`.claude/agents/`, [ADR-0021](0021-orchestrator-and-subagents.md)).
  - **Read-only**: never an MCP that modifies resources, deploys or uses production keys ([ADR-0041](0041-agent-boundaries.md)). Stripe, only in test mode.
  - **Never secrets or customer data in queries** ([ADR-0043](0043-public-repo.md) list).
- **Repo configuration** (free because it is public, [ADR-0043](0043-public-repo.md)):

| Piece | What it provides |
|---|---|
| CodeQL | Security analysis on every PR |
| Dependabot (security alerts only) | Notice when a dependency has a vulnerability |
| Renovate | Grouped, scheduled version-update PRs, reviewed by the agent like any other |
| pnpm `minimumReleaseAge` | Does not install versions published less than a few days ago (protection against newly uploaded malicious packages) |
| pnpm `onlyBuiltDependencies` | Only the packages on a list run install scripts |
| Knip in `pnpm check` | Unused files, exports and dependencies |
| OpenSSF Scorecard | Repo security score, reviewed in the monthly review ([ADR-0040](0040-process-metrics-and-monthly-review.md)) |
| Claude Code hooks | Technically enforce what is an instruction today: the implementer does not edit `e2e/acceptance/` ([ADR-0030](0030-test-designer.md)) nor write anything from the [ADR-0043](0043-public-repo.md) list |

  - ⚠ Socket.dev (suspicious package detection): check whether its free plan covers the repo before adding it.

## Consequences

- **Ruled out**: AI web search engines (Exa, Perplexity: web search already exists and they would be another account and quota), the GitHub MCP (`gh` does the same), paid security scanners.
- Pending check: whether Socket.dev's free plan covers the repo.
