---
status: accepted
date: 2026-11-10
---

# ADR-0025: User help with Starlight

## Context

Users need a help guide that is cheap to run and stays in step with the product. It must not add a project, a deployment or a cost ([ADR-0012](0012-workers-static-assets-no-pages.md)).

## Decision

- **Decision**: Starlight (Astro docs) as an integration inside `apps/marketing`, served at `/docs` (`en`) and `/es/docs` (`es`) with Starlight's multi-language support ([ADR-0047](0047-i18n-from-the-start.md)). Markdown in `apps/marketing/src/content/docs/`; `en` first, `es` when translated. **Superseded on this point** by [ADR-0047](0047-i18n-from-the-start.md): public content, help included, is multi-language from day one.
- Static HTML in the same Worker ([ADR-0012](0012-workers-static-assets-no-pages.md)): no extra project, deployment or cost. Search with Pagefind.
- **Rule**: a visible change updates the guide in the same PR (Document step). The orchestrator decides with the rules of [ADR-0020](0020-ticket-lifecycle.md); the person can correct it at moment 2.
- The SPA links to `/docs/...` from every screen.

## Consequences

- **Ruled out**: Outline, GitBook/Mintlify, Crisp's knowledge base.
- **Review if** the help starts to be written by staff who do not use Git (a CMS over the same markdown files).
