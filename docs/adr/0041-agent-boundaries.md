---
status: accepted
date: 2026-11-12
---

# ADR-0041: Agent boundaries

## Context

Agents work on the repository and need limits on identity, privilege, credentials and irreversible actions. GitHub does not allow approving one's own PR: if the agent used the human account, the approval would be worth nothing.

## Decision

- **Own identity**: agents work on GitHub as their own **GitHub App**, never with the person's account. GitHub does not allow approving one's own PR: if the agent used the human account, the approval would be worth nothing. The app has minimal permissions (contents, pull requests, issues; no administration) and is on no bypass list. The person creates and installs it (🧑, "Working foundation" PRD, ticket 2).
- **Least privilege**: agents cannot merge to `master`, approve Environments or deploy to production; the rulesets require human approval. A ruleset on all branches blocks force push, so that the history of a PR cannot be rewritten (acceptance scenarios, [ADR-0030](0030-test-designer.md)). The implementer's permissions prevent it from editing `**/e2e/acceptance/**`.
- **No credentials**: they never create, read or rotate secrets; they have no production tokens. Steps with credentials are manual 🧑 steps ([ADR-0035](0035-technical-work-and-bootstrap-prd.md)). They only use 1-hour installation tokens of the GitHub App; the App's key is out of their reach ([ADR-0064](0064-local-secrets.md)).
- **AI review in CI**: every PR gets an automatic AI review that applies `REVIEW.md` ([ADR-0015](0015-agent-context-multi-tool.md)), in addition to the human one and the Verify step reviewers. **Decided (2026-11-12): CodeRabbit on its free plan**, which covers public repos ([ADR-0043](0043-public-repo.md)); it is installed as a GitHub app after the repo is created ("Working foundation" ticket 2), without touching CI. It comments and proposes; it does not approve or block, except for a finding from the "No entra" list ([ADR-0043](0043-public-repo.md)). Alternative or complement: Claude Code Action with the token of a personal Claude subscription (`claude setup-token`), never with a work subscription.
- **Irreversible actions** (deleting data, purges, production configuration changes): always with explicit confirmation from the person.

## Consequences

Copilot review is ruled out (it is not in the free plan).
