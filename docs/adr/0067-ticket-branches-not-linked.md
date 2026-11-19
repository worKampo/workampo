---
status: accepted
date: 2026-11-19
related: [39, 43, 45]
---

# ADR-0067: Ticket branches are not linked to the issue

## Context

[ADR-0042](0042-traceability.md) created the ticket branch with `gh issue develop`, which links it in the issue's *Development* section. GitHub closes an issue when its linked branch is merged. Tickets #39 and #43 closed at their merge, before the clean observation window that closes a ticket ([ADR-0020](0020-ticket-lifecycle.md)).

## Decision

- `pnpm work start` creates the branch from an up-to-date `master`, never with `gh issue develop`; a branch already on GitHub is reused. Name and format do not change ([traceability](../procedures/traceability.md)).
- The PR is related to the issue by `Ticket #N` in its body, which GitHub shows in the issue's timeline, not by the *Development* section.
- This supersedes the Branch and PR rows of ADR-0042 and the *Development* step of its navigation; the rest of ADR-0042 stands.

## Consequences

- The issue stays open until the orchestrator closes it after the observation window.
- The issue's *Development* section stays empty; the branch and PR are found through the timeline, the PR body and `pnpm work status`.
