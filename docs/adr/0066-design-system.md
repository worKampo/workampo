# ADR-0066: Design system: neutral chrome, ink accent, IBM Plex Sans

- Status: accepted (2026-11-12).
- Date: 2026-11-11
- Confirmed with it: skeletons after ~300 ms, format validation on blur, Undo toast for reversible actions, amber usage bar at 80 %, IBM Plex Sans self-hosted (nothing from third parties on `/login`, D32).

## Context and problem statement

D31 makes `docs/design/` (tokens for light and dark, adapted shadcn components, patterns, tone) a prerequisite of the UI/UX designer role, and asks for an ADR once the design experiments are reviewed.

Two experiments were made before the canvas:

1. A **weCampo-style** design: shadcn zinc palette, Geist typeface, green accent.
2. A **reference design** with a different visual language: neutral grey chrome, white surfaces, ink as the only accent, colour only for data.

The approved design canvas ("SaaS Base · Pantallas") redrew every v1 screen (app, backoffice, public and auth pages; light and dark; desktop, tablet, phone) in the reference visual language. We need to record which language the product adopts and what it keeps from the first experiment.

## Decision drivers

- Accessibility: WCAG 2.2 AA (D31), including the staff banner and focus states.
- Neutral base: the product is a generic SaaS base (D1); companies bring their brand to their own landings, not to the app.
- Data-dense screens (lists, KPIs, billing, backoffice) must stay readable; colour must carry meaning.
- Low cost to build and maintain on shadcn/ui + Tailwind v4 (stack), with one set of tokens for app, backoffice and Astro pages.
- Light and dark from day one; respect the user's system preference.
- Works for agents: values and rules written down so the designer role can verify against them.

## Considered options

1. Keep the zinc / Geist design with a green accent.
2. Adopt the reference visual language (grey chrome, white surfaces, ink accent, IBM Plex Sans).
3. Plain shadcn defaults (neutral theme, no customisation).

## Decision outcome

Chosen option: **2, adopt the reference visual language**, because it keeps colour free for status and data, gives a calm and neutral base that suits a generic product, and was validated across every v1 screen in the canvas, light and dark, on three devices.

Kept from the previous design (option 1):

- Respect `prefers-color-scheme`: the theme preference defaults to System.
- The accessible **amber staff banner** for "Enter as" sessions (D50), with text in `--warn-text` for contrast.
- **36 px** inputs and buttons on desktop (44 px on touch).
- **12 px** radius for modals and other overlays.
- Accessibility fixes over the reference: no text or controls at 40–50 % opacity (contrast), select chevrons in a token colour instead of a fixed `#888`, and `aria-modal` with labelled dialogs and drawers.

The values live in `packages/ui/src/styles/tokens.css`; components, patterns and copy rules in `docs/design/`.

### Consequences

- Good: one accent (ink) makes the primary action obvious and keeps green/blue/red unambiguous as status colours.
- Good: tokens map onto shadcn variables, so shadcn components work with few overrides; the same tokens serve Astro pages.
- Good: dark mode is a second token set, not a second design.
- Good: the canvas is the visual reference for the designer role in Specify and Verify.
- Bad: several shadcn components need adaptation (outline buttons, inverted toast and tooltip, bottom-sheet dialog on phone, sidebar active vs hover); `components.md` lists them.
- Bad: IBM Plex Sans must be self-hosted to keep `/login` free of third-party requests (D32).
- Bad: ds.css uses `--accent` for ink while shadcn uses `--accent` for hover surfaces; `tokens.css` drops ours in favour of `--ui`.
- Neutral: the notification count colour is hardcoded in the canvas and has to become a token when implemented.

## Pros and cons of the options

### 1. Zinc / Geist with green accent

- Good: close to shadcn defaults; little customisation.
- Good: familiar from weCampo.
- Bad: green as the brand accent collides with green as "positive" status.

### 2. Reference visual language

- Good: colour reserved for meaning; strong hierarchy with ink.
- Good: complete coverage in the canvas (light/dark, desktop/tablet/phone).
- Good: IBM Plex Sans has clear tabular figures for data-heavy screens.
- Bad: more token and component adaptation work than defaults.

### 3. Plain shadcn defaults

- Good: zero design work, easy upgrades.
- Bad: generic look; no answer for staff sessions, saved views, KPI filters or responsive shell.
- Bad: the designer role would have nothing specific to verify against.

## Links

- [`docs/design/`](../design/README.md): tokens, components, patterns, content.
- Design canvas "SaaS Base · Pantallas" (private): <https://claude.ai/artifact/5b46Drc9rY8rk95LY5XBAi>
- [ADR-0031](0031-ui-ux-designer.md) (UI/UX designer, accessibility, SEO), [ADR-0047](0047-i18n-from-the-start.md) (internationalisation), [ADR-0050](0050-enter-as-staff-impersonation.md) ("Enter as"), [ADR-0032](0032-security-reviewer.md) (no third-party scripts on `/login`).
