---
status: accepted
date: 2026-11-14
---

# ADR-0031: UI/UX designer: interface, accessibility and SEO

## Context

How a screen looks is part of what is asked for, so what is visible is approved at moment 1 ([ADR-0020](0020-ticket-lifecycle.md)), together with the examples.

## Decision

- **Prerequisite**: `docs/design/` (light/dark tokens, adapted shadcn components, patterns for forms, tables, drawers and URL state, tone of the texts). Its own accepted ADR ([ADR-0066](0066-design-system.md)).
- **Role** (`docs/agents/ui-ux-designer.md`). **It does not implement**: it designs and reviews.

| Moment | What it does | Deliverable |
|---|---|---|
| PRD (P1) | **Navigable prototype** (HTML or artifact) to validate with the person before slicing. Recommended in PRDs with a new interface | Prototype linked in the PRD's issue |
| Specify | Flow and **all states** of each screen: empty, loading, error, no permissions, long data/unicode, mobile | UI section in the issue, next to the intent (M and L) |
| Verify | Reviews against the spec and `docs/design/` on light/dark and mobile/desktop screenshots | Matrix in the issue's "Work log" comment |

- **Interface change levels** (2026-11-14). How a screen looks is part of what is asked for, so what is visible is approved at moment 1 ([ADR-0020](0020-ticket-lifecycle.md)), together with the examples. The designer proposes the level and the person confirms it together with the size:

| Level | Change | What is approved at moment 1 |
|---|---|---|
| **0** | Nothing visible | Nothing |
| **1** | Inside an existing pattern: a field, a column, a text, a state | Description in the issue's UI section, naming the pattern; no mockup. It is seen on the real screen at moment 2 |
| **2** | New screen, or a major change to an existing one, with existing patterns | Mockup with all states (empty, loading, error, no access, mobile, dark); in a change, before and after side by side |
| **3** | A pattern or component that does not exist in `docs/design/` | Level 2 plus the proposal of the pattern or component, with the why. The change to `patterns.md` or `components.md` goes in the same PR. The ticket is at least M |

  - **No prior design**: the designer first searches `docs/design/` for the pattern that fits and composes with what exists (level 2); if nothing fits, level 3. In a PRD with several new screens, this is the navigable prototype.
  - **Existing design that must change**: when asking, start from a screenshot of the current app and show the before and the after. During implementation, an adjustment inside the pattern that does not change what the screen does is decided by the agent, with a before and after screenshot in "Decisions made". If it contradicts the approved mockup or visibly changes what the user sees, it is stop 1 of [ADR-0020](0020-ticket-lifecycle.md). At moment 2, whatever is not liked is an "Adjustment within scope" finding.
  - **Where it lives**: the mockup, in HTML in the prototype (outside the repo); the approved screenshots (light and dark, desktop and mobile), in the issue's UI section, as a temporary record ([ADR-0052](0052-living-specs-only-and-flow-by-size.md)). After the merge, **the truth is the implemented app** plus the rules of `docs/design/`: the canvas and the prototype are not kept as a mirror of the app and serve to propose changes. The canvas still rules for tokens and for screens not yet built.
  - **Verify**: the UI/UX reviewer compares the implementation with the approved screenshots and with `docs/design/`.
- **Accessibility** (WCAG 2.2 AA): keyboard, focus, contrast, labels and associated errors, `alt`, `prefers-reduced-motion`, touch targets, screen readers in drawers and modals. Automatic: `@axe-core/playwright` in every E2E; serious violations break CI.
- **SEO** (public pages only: marketing, help, changelog, landings): unique title and description, Open Graph, canonical, `hreflang` between languages ([ADR-0047](0047-i18n-from-the-start.md)), `sitemap.xml`, `robots.txt`, structured data where useful, correct headings, optimized images. Landings: SEO fields per company and a sitemap entry; when going from `path` to `subdomain`, 301 from the old URLs. App and backoffice with `noindex`. Automatic: Lighthouse in CI with thresholds that break CI.
- **When**: the orchestrator activates it if the ticket touches the interface or public pages, or skips it with the reason in "Decisions made" ([ADR-0020](0020-ticket-lifecycle.md)). **It is not skipped** in new complete flows or new public pages.
- Level `standard`; `max` in new complete flows.

## Consequences

- **Deferred**: visual regression.
