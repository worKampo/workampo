# Design

The visual language, components, patterns and copy rules for every user interface in this repo: the company app and the backoffice (Vite + React SPA, shadcn/ui, Tailwind v4) and the public pages (Astro). It is the prerequisite of the UI/UX designer role (D31).

## Principles

| Principle | Rule |
|---|---|
| Grey chrome, white surfaces | The shell (sidebar, topbar, page background) is grey `--chrome`. Content sits on white `--surface` islands (cards, tables, drawers, dialogs). In dark mode the chrome is black and surfaces are near-black. |
| Ink is the only accent | Primary buttons, focus rings, selected states and progress use ink (`--ui`). No brand colour in the app. |
| Colour only for data and status | Green `--pos`, blue `--info`, red `--neg` mark state (badges, banners, charts). Amber `--warn-*` is reserved for staff sessions and warnings. Never colour for decoration. |
| Inverted feedback | Toast, tooltip and save bar use ink background with inverted text. |
| One typeface | IBM Plex Sans 400/500/600, self-hosted in production (no font CDN on `/login`, D32). |
| Tabular numbers | `font-variant-numeric: tabular-nums` everywhere, so figures align in tables and KPIs. |
| Accessible by default | WCAG 2.2 AA (D31): visible focus, 44 px targets on touch, labels on every control, `prefers-reduced-motion` and forced colours respected. |

### Type scale

| Use | Size / line height · weight |
|---|---|
| Display (public pages) | 48/52 · 600 (tablet 40/44, phone 32/38) |
| Lead (public pages) | 17/26 · 400 (phone 15/24) |
| Page title `h1` | 24/32 · 600, tracking -0.02em |
| KPI value | 24/32 · 600 |
| Section title `h2` | 16/24 · 600 |
| Card title `h3` | 13/20 · 600 |
| Body (app base) | 13/20 · 400, colour `--text-1` |
| Meta, help, errors | 12/16 · 400 |
| Overline | 11/16 · 600, tracking 0.06em, uppercase in copy |

### Geometry

Sidebar 256 px (rail 64, off-canvas 280) · touch topbar 56 px · controls 36 px desktop, 44 px touch · radius 8 controls, 12 cards and overlays, 999 pills · page content max 1280 px, editors 880 px · gaps mostly 8, 12, 16, 24, 32.

## Where the canvas lives

The original screens are in the claude.ai design canvas **"SaaS Base · Pantallas"**: <https://claude.ai/artifact/5b46Drc9rY8rk95LY5XBAi>. It is **private**: only its owner can open it; ask for access or a screenshot. Every screen has light/dark and desktop/tablet/phone variants.

What wins when sources differ:

| Topic | Source of truth |
|---|---|
| Tokens | The canvas `ds.css`; [`tokens.css`](tokens.css) is fixed in a PR to match it |
| Screens not built yet | The canvas |
| Screens already built | **The implemented app** plus the rules in this folder. The canvas and the prototype are not kept as a mirror of the app; they are for proposing changes, always starting from a screenshot of the current app |

Placeholders such as `[YOUR PRICE]` in the canvas are undecided content, not copy (see [content.md](content.md)).

## How the docs are used (D31)

| Step | Use |
|---|---|
| PRD (prototype) | Prototypes reuse the tokens, components and shell from here, so they look like the product. |
| Specify | The UI section in the issue, next to the intent (D52), states the **UI change level** (below), lists every screen state from [patterns.md](patterns.md#screen-states) and names the components from [components.md](components.md). Anything not covered here is level 3. The person approves it in moment 1 (D20), together with the examples. |
| Implement | `tokens.css` is the single source of tokens: apps import it from `packages/ui`, never copy or override it per app. shadcn components are adapted as described in `components.md`, and apps use only scale classes, no arbitrary Tailwind values (D53). |
| Verify | The UI/UX designer checks screenshots (light/dark × desktop/phone) against the approved screenshots in the issue and these docs, and fills the matrix in the issue's "Work log" comment. A deviation is either fixed or proposed as a change to these docs in the same PR. |

### UI change levels (D31)

| Level | Change | Approved in moment 1 |
|---|---|---|
| 0 | Nothing visible | Nothing |
| 1 | Within an existing pattern: a field, a column, a text, a state | A description in the issue's UI section naming the pattern; no mockup |
| 2 | A new screen, or a major change to an existing one, using existing patterns | A mockup with every state (empty, loading, error, no access, phone, dark); for a change, before and after side by side |
| 3 | A pattern or component that is not in this folder | Level 2 plus the proposed pattern or component and why; the change to `patterns.md` or `components.md` ships in the same PR. The ticket is at least M |

Mockups are HTML in the prototype (outside the repo); the approved screenshots go in the issue's UI section. During implementation, an adjustment within the pattern that does not change what the screen does is the agent's call (before/after screenshots in "Decisions made"); anything that contradicts the approved mockup stops the agent and goes back to the person.

## Brand

The worKampo logo marks the platform, never a customer company: inside a company's app and on its public page the company's own logo leads. Its colours (sky `#4AACDF`, green `#42843C`, orange `#F2760A`) stay in the logo; the interface keeps ink as its only accent.

| File in [brand/](brand/) | Where |
|---|---|
| `logo-color.svg` | Platform header and sidebar, next to the name "worKampo" in IBM Plex Sans: landing, sign in, company picker, create company, system pages, backoffice. Transparent, with the K cut out, so it works on light and dark |
| `logo-color-16.png`, `logo-color-32.png` | Favicon |
| `logo-icon-light-180.png`, `-192.png`, `-512.png` | App icon (iOS, Android, PWA) and GitHub avatars |
| `logo-mono-black.svg`, `logo-mono-white.svg` | The "Made with worKampo" mark in the footer of a company's public page, light and dark |

The full kit, with every size and variant, lives outside the repo; add a file here only when a screen needs it.

## Files

| File | Content |
|---|---|
| [brand/](brand/) | The worKampo logo files the product uses ([Brand](#brand)) |
| [tokens.css](tokens.css) | Light and dark tokens, mapped to shadcn variables and Tailwind v4 utilities |
| [components.md](components.md) | Each component: anatomy, sizes, variants, states, a11y, shadcn base |
| [patterns.md](patterns.md) | Shell, navigation, lists, forms, overlays, destructive actions, screen states, staff session, responsive, dark mode |
| [content.md](content.md) | Voice and tone, labels, errors, empty states, formats, i18n |
| [../adr/0066-design-system.md](../adr/0066-design-system.md) | Why this visual language (ADR-0066) |
