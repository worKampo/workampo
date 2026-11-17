---
status: accepted
date: 2026-11-10
---

# ADR-0026: User changelog

## Context

Users need to know what changed, in customer language, without a separate release process.

## Decision

- **Decision**: one markdown entry per visible change in `apps/marketing/src/content/changelog/<date>-<slug>.md`; page `/docs/changelog` with an RSS feed.
- **Rule**: in the same PR as the change (Document step), in customer language and linking to the guide. The orchestrator decides with the rules of [ADR-0020](0020-ticket-lifecycle.md); the person can correct it at moment 2.
- It appears in production exactly when the feature ships ([ADR-0012](0012-workers-static-assets-no-pages.md)). If it ships switched off behind a flag, `draft: true` until it is activated.
- Technical history: the `git log` of `master` ([ADR-0023](0023-branching-and-deployment.md)).

## Consequences

- **Deferred**: in-app notice of news.
- **Ruled out**: Changesets, GitHub Releases, semantic versioning.
