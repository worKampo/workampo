---
status: accepted
date: 2026-11-21
related: [54, 66]
---

# ADR-0070: Colour for business moments and free rein on marketing pages

## Context

[ADR-0066](0066-design-system.md) made ink the only accent, kept colour for data and status, and left the brand out of the app. The worKampo logo now exists (sky `#4AACDF`, green `#42843C`, orange `#F2760A`). The person keeps the monochrome app and wants colour only where it serves the business or an alarm, and wants pages that win customers to use every resource that helps, without overdoing it (issue #54).

## Decision

Decided by the person in issue #54 (2026-11-21); the canvas screens with the commercial emphasis approved the same day.

- **The app stays monochrome.** Colour has three reasons: data, status or alarm (as in ADR-0066) and, new, a **business moment**.
- **One commercial colour**, `--commercial`, the logo's sky: the end of a trial, "Upgrade", the recommended plan, a "New" badge. Not green or orange, which read as "OK" and "warning". At most one per screen, always as a fill, a band or a ring; a small badge alone is `--info`. Primary buttons, links, focus and selection stay ink.
- **Marketing pages have free rein** with the logo palette, illustration and graphic resources: the worKampo landing, pricing, the marketing site, and help or changelog pages that sell. Limits: one accent per section, the primary button in ink, WCAG 2.2 AA (sky and orange never as text on a light background), and light pages (static HTML, no heavy media).
- **Not marketing pages**: sign in and create company (product: monochrome with the logo) and a company's public page (its brand is the company's).
- **Themes**: the app and the backoffice keep light and dark. Marketing pages and a company's public page are **light only** and do not follow the visitor's system. Letting each company choose a theme for its public page is for later (PRD #12).

This supersedes in part ADR-0066: "Ink is the only accent", "no brand colour in the app" and "public pages respect `prefers-color-scheme`". The rest of ADR-0066 stands.

## Consequences

- Tokens `--commercial` (with `--on-commercial`, `--commercial-bg`, `--commercial-border`, `--commercial-text`, light and dark) and `--brand-*` (light only) in [`docs/design/tokens.css`](../design/tokens.css); usage in [`patterns.md`](../design/patterns.md#commercial-emphasis-adr-0070).
- Contrast, measured: ink on sky 7.43:1; `--commercial-border` 3.84:1 on white and 3.47:1 on the chrome; `--commercial-text` 5.45:1 and 4.92:1; sky on the dark surface 7.68:1.
- Sky sits apart from `--info` (indigo `#2C48A8`) by hue and by shape, so a business moment does not read as information.
- The design canvas shows the commercial emphasis in the sidebar trial and the recommended plan.
