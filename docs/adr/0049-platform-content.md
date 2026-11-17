---
status: accepted
date: 2026-11-10
---

# ADR-0049: Platform content: mixed model

## Context

The platform has several kinds of content (help, changelog, legal pages, corporate website) with different update rhythms and owners.

## Decision

- **In the repo, by PR**: help ([ADR-0025](0025-user-help-with-starlight.md)), changelog ([ADR-0026](0026-user-changelog.md)) and legal pages ([ADR-0027](0027-legal-and-data-protection.md)). They are tied to the code or to legal reviews and are updated in the same PR.
- **Corporate website**: in v1, Astro inside the repo (`apps/marketing`). Later, a candidate to move to the **company landing engine** ([ADR-0004](0004-landings-rendered-in-the-worker.md)) as a "system company", editable from the backoffice with the same drawers: we test the editor ourselves and do not build a second CMS. It will be its own ticket with an ADR.

## Consequences

**Ruled out**: an in-place editor for all content (as in weCampo): it breaks the rule of help and changelog in the same PR and forces building drafts, versions and permissions.
