# Components

This is the catalogue of global components, which live in `packages/ui` (D53). Before creating a component, look here and in `packages/ui`. Domain components compose these; a component born in one domain moves to `packages/ui` (or the app's `_shared/components/`) when a second domain needs it.

Each component adapts a shadcn/ui component (or is a small custom one) to the tokens in [tokens.css](../../packages/ui/src/styles/tokens.css). Sizes are desktop / touch (tablet and phone). Radii: 8 px controls, 12 px cards and overlays, 999 px pills; 4 px only for kbd and tags, 6 px for inner segments and skeletons, 16 px for the top corners of a phone bottom sheet.

General rules:

- Focus: every focusable element shows `:focus-visible` as a 2 px `--ui` outline, offset 2 px. Fields replace it with their own ring (below).
- Touch targets: 44 px on touch for buttons, fields and icon buttons. Smaller controls (chips 32, segments 28) still meet the WCAG 2.2 minimum of 24 px.
- Disabled: background `--muted`, text `--text-3`, `cursor: not-allowed`. Prefer `aria-disabled="true"` with a tooltip that explains why when the user would otherwise not know (for example "Read-only session").
- Selected states keep a visible outline in forced-colours mode.

## Actions

### Buttons

shadcn `Button`. Height 36 / 44, small 32 / 40, padding 0 16 (small 0 12), radius 8, 13 px weight 500, gap 8 between icon and label.

| Variant | Look | shadcn variant | Use |
|---|---|---|---|
| Primary | `--ui` fill, `--on-ui` text; hover `--ui-hover` | `default` | The one main action of a view |
| Secondary | Transparent, 1 px `--border-hard`, `--text-1b`; hover border and text `--text` | `outline` | Other actions, Cancel |
| Ghost | Transparent, underlined `--text-1` | `link` | Low-weight inline actions: Discard, Save view |
| Quiet | Transparent; hover `--nav-hover` | `ghost` | Toolbar and row actions, icon buttons in chrome |
| Danger | `--neg` fill, `--on-neg` text | `destructive` | Final confirm of a destructive action |
| Danger outline | `--neg-border` border, `--neg` text; hover fills `--neg` | new `destructive-outline` | Opens a destructive flow (Remove member…) |
| Icon-only | Square 36 / 44 (small 32 / 40), any variant | `size="icon"` | Secondary page actions and row menus |

- Icon-only buttons always have `aria-label` and a tooltip with the same text.
- One primary per view. Discard (drop unsaved edits) is not Cancel (close without acting).
- A link that navigates is an `<a>` styled as a button, never a button inside a link.

## Forms

### Fields

shadcn `Input`, `Select`, `Textarea`, `InputGroup`, `Label`.

| Part | Spec |
|---|---|
| Label | Above the field, 12/16 weight 500 `--text-1`, gap 6 |
| Input, select | 36 / 44, padding 0 12, radius 8, 1 px `--field-border`, background `--field-bg`, text 13 px (16 px on touch to avoid zoom on iOS) |
| Hover | Border `--field-hover-border` |
| Focus | Background `--field-focus`, no outline, ring `--shadow-focus` (`0 0 0 1px --ui, 0 0 0 4px --focus-halo`) |
| Error | Border `--neg`; message below in 12/16 `--neg` with an icon; `aria-invalid="true"` and `aria-describedby` to the message |
| Help | 12/16 `--text-2`, linked with `aria-describedby` |
| Textarea | Min height 88, padding 8 12, line height 1.5, vertical resize |
| Select | Chevron at the right, padding-right 32 |
| Input group | One bordered box with a prefix (`--text-2`, e.g. a URL base) and the input; the focus ring goes on the group (`:focus-within`) |
| Search | Input with a 16 px icon at left 12, padding-left 36, background `--chrome-control`; label visually hidden |
| Form | `Form` stacks its fields and actions 16 px apart and turns off the browser's validation; our messages show the errors |

### Choice controls

| Component | shadcn | Spec |
|---|---|---|
| Checkbox | `Checkbox` | 16 px, ink when checked. Each one has an accessible name ("Select Marc Puig", "Select all") |
| Choice card | `RadioGroup` item as a card | Padding 12, radius 12, `--border`; selected: `--text` border + 1 px ring |
| Switch | `Switch` | 36 × 20 track, 13 px thumb. Off: 1.5 px `--field-border` outline and thumb. On: `--ui` track, `--on-ui` thumb. Label next to it, state not conveyed by colour alone |
| Segmented | `ToggleGroup` (`type="single"`) | Padding 2 inside a `--border` box, radius 8; segments 28 high, 12 px; selected: `--surface`, `--border-hard`, small shadow, weight 600. `aria-pressed` on each |
| Tabs | `Tabs` | 36 high, 13 px, bottom border `--border`; selected: 2 px `--text` underline, weight 600. `role="tablist"` / `tab` / `aria-selected`; scrolls horizontally on narrow screens |
| Filter chip | `Toggle` | 32 high, pill, `--border`, `--surface`; selected: `--text` border, `--muted` fill, `aria-pressed="true"`. "Filters" chip on touch uses `--chrome-control` |
| Tag | custom | 24 high pill, `--muted`; a 20 px remove button with `aria-label="Remove …"`; error variant `--neg-bg` / `--neg` (e.g. an invalid email) |

## Content

### Cards and stats

shadcn `Card`.

- Card: `--surface`, 1 px `--border`, radius 12. Padding 20 (16 on phone); with a header: head 16 16 8, body 0 16 16.
- Stat (KPI): card with padding 16, label in meta, value 24/32 weight 600. When the KPI filters the list below, it is a `<button>` with `aria-pressed`; pressed shows a `--text` border + 1 px ring. The group has `aria-label="Summary, click to filter"`. A KPI that does not filter is a plain card.
- KPI grid: 4 columns on desktop, 2 on touch, gap 16 / 12.

### Badges and small marks

| Component | shadcn | Spec |
|---|---|---|
| Badge | `Badge` | Pill, padding 2 8, 12/16 weight 500, a 6 px dot in the text colour + text. Variants: `pos` (Active), `info` (Invited), `neg` (Failed), neutral `--muted` (Suspended), `plain` without dot (roles: Owner, Admin) |
| Edited pill | custom | 18 high pill, `--muted`, 11 px weight 600, 6 px `--warn-dot` dot. Only next to a saved view that has unsaved changes |
| Kbd | `Kbd` | 11/16, min width 16, 1 px `--border-hard` with 2 px bottom, radius 4, `--text-2` |
| Count | custom | 20 high pill, `#C4221A` with white text, 11 px weight 600. Notifications only. Not a token in ds.css yet: promote it when implemented. The accessible name carries the number ("Notifications, 3 unread") |
| Staff tag | custom | "STAFF", 11 px weight 600, radius 4, 1 px `--border-hard`. Backoffice workspace button |

### Avatars

`Avatar` in `packages/ui` (content family). Workspace logo in the sidebar: 32 square radius 8 in `--ui`. Initials and colour come from `packages/domain/src/_shared/avatar.ts`, so web, mobile and emails agree.

```tsx
<Avatar kind="person" name={user.name ?? user.email} />
<Avatar kind="company" name={company.name} src={company.logoUrl} size="lg" />
```

`name` is the name, or the email when there is none yet: the caller chooses. With `src`, the image takes the same size and shape; if it fails, the initials. Uploading photos and logos: ticket 127 (Post-MVP).

- **E1 shape from the kind.** Nobody picks it. Person: circle, 32 (large 48), initials 11 px (large 15). Company: rounded square 32 radius 8 (large 48 radius 12), initials 12 px (large 16). Weight 600.
- **E2 initials of a name.** The first letter of the first and the last word, or the first two of a single word: "Lucía Ortega" → LO, "Northwind Logistics" → NL, "Sol" → SO. Particles do not count ("María de la Cruz" → MC); accents and ñ stay ("Ñandú Álvarez" → ÑÁ).
- **E3 no letter first.** Only letters count: "3M España" → ME, "🚀 Rocket" → RO, "R2D2" → RD. No letter at all: a generic person icon on `--muted`.
- **E4 no name.** The caller passes the email, which gives its first letter ("ana@example.com" → A).
- **E5 colour from the initials.** The same initials always get the same of six colours, `--avatar-1..6-bg` and `-fg` (violet, plum, slate, brown, teal, olive), on any screen and theme. Initials reach AA: 5.8–7.6:1 light, 8.2–9.2:1 dark. None is a status, data or commercial hue ([ADR-0070](../adr/0070-colour-commercial-emphasis-and-marketing.md#updates)).
- **E6 image.** With `src`, the image takes the same size and shape as the initials (decorative, `alt=""`); if it fails to load, the initials and colour of E2–E5.
- **Accessibility.** Always decorative (`aria-hidden`): the name next to it carries the meaning; a lone avatar button has the `aria-label` ("Account: Lucía Ortega").

## Data

### Tables and card lists

shadcn `Table` on desktop; a card list on touch with the same rows.

| Part | Spec |
|---|---|
| Wrapper | `--surface`, 1 px `--border`, radius 12, horizontal scroll if needed |
| Header | 40 high, `--table-head`, 12 px weight 500 `--text-2`, `scope="col"` |
| Cell | Padding 8 12, top border `--muted`; row hover `--surface-hover`; selected row `--muted` |
| Numbers | Right aligned, `--text`, tabular |
| Person cell | Avatar + name (weight 500 `--text`) + secondary line (12/16 `--text-2`); the name links to the record |
| Actions column | 56 wide, a quiet small icon button `aria-label="Actions for {name}"` opening a menu; header text visually hidden |
| Selection | First column with checkboxes and "Select all" |
| Card list (touch) | `<ul>`, `--surface`, radius 12; each `<li>` padding 12: checkbox, avatar + name line, then badges and meta, row actions as a `…` icon button |

### Bulk bar

Custom. Appears above the list when rows are selected: `--muted` background, radius 12, padding 8 12 8 16. Left: "2 selected" (weight 500); right: secondary small buttons for the bulk actions and a quiet "Clear selection". `role="region"` with `aria-label="Bulk actions"`.

### Pager

shadcn `Pagination`, reduced. Left: result count in `--text-2` with `aria-live="polite"` ("Showing 1–6 of 6"); right: Previous / Next secondary small buttons, disabled at the ends.

## Feedback

### Banners

shadcn `Alert`. Padding 12 16, radius 12, 1 px border, icon + text (title in weight 600 inline) + optional action on the right.

| Variant | Colours | Role | Use |
|---|---|---|---|
| Neutral | `--muted`, `--border` | `status` | Neutral notes |
| Info | `--info-bg`, `--info-border` | `status` | "Visitors may see the previous version for about a minute" |
| Positive | `--pos-bg`, `--pos-border` | `status` | "Published." |
| Negative | `--neg-bg`, `--neg-border` | `alert` | Payment failed, error summary on submit |
| Staff | `--warn-bg`, `--warn-border`, text and links `--warn-text` | `status` | Staff sessions only (D50) |

`strip` modifier: full width, no radius, only a bottom border; used for banners across the top of the main column.

### Empty state

shadcn `Empty`. Centred column, gap 12, padding 56 16, 1 px **dashed** `--border-hard`, radius 12, `--surface`. The **logo mark in ink** (below) at 40 px, `h2`/`h3` title, one paragraph `--text-2` (max 360 px), one action. Copy rules in [content.md](content.md#empty-states).

### Skeleton

shadcn `Skeleton`. Blocks shaped like the final content (avatars as circles, text lines at 60–100 % width), gradient `--sk1` → `--sk2`, radius 6, 1.4 s shimmer. The container has `aria-busy="true"` and `aria-label="Loading"`. No animation with `prefers-reduced-motion`.

### Progress and usage bar

shadcn `Progress`. Progress 8 high radius 4; compact usage bar (sidebar "Members 4 of 5") 6 high radius 3. Track `--muted`, fill `--ui`; warning fill `--warn-dot` when close to a limit (≥ 80 % suggested). Always show the number in text next to it ("4 of 5"); give the bar `aria-valuenow`/`aria-valuemax` or hide it from assistive tech when the text says the same.

### App loader

Custom. The logo mark in ink, 48 px, centred on `--bg`, with a bead cut into the arc that slides along it and back (1.6 s, ease-in-out). Only while there is no layout to draw yet: the first load, after sign-in and when switching company; it appears after about 300 ms. Inside a screen, a skeleton. `role="status"` with `aria-label="Loading"`. With `prefers-reduced-motion` the bead stays still at the top of the arc.

## Overlays

### Drawer

shadcn `Sheet` (`side="right"`). Width min(480 px, 100 %), full width on phone. `--drawer` background, left border, `--shadow-drawer`, over the `--scrim`. Head (padding 24 24 16, bottom border): title, meta, close button. Body (padding 24, gap 24, scrolls). Foot (padding 16 24, top border): actions. Phone: side padding 16. `role="dialog"`, `aria-modal`, `aria-labelledby` the title; focus moves in on open and returns to the trigger on close; Esc closes (with the unsaved-changes guard).

### Dialog

shadcn `Dialog` / `AlertDialog` (destructive confirmations). Max width 480 (wide 600), `--surface`, radius 12, `--shadow-modal`, centred over the `--scrim`. Head padding 24 24 0 with title and close; body 16 24 24, gap 16; foot 16 24 with top border, actions right-aligned (secondary, then primary). On phone the same component becomes a **bottom sheet**: anchored to the bottom, full width, top corners 16. Same a11y as the drawer.

### Popover and menu

shadcn `Popover`, `DropdownMenu`. `--surface`, 1 px `--border`, radius 12, `--shadow-pop`, padding 4, min width 200. Menu item: 36 high, padding 0 10, radius 8, 13 px `--text-1`; hover / highlighted `--surface-hover` + `--text`; danger item `--neg`; separator 1 px `--border` with 4 px margin. Radio items (saved views) use `menuitemradio` + `aria-checked`.

### Command palette

shadcn `Command` inside a `Dialog`. Opened with Ctrl K (Cmd K on macOS), the sidebar Search item or the topbar search button. Panel max width 600, radius 12, `--shadow-modal`, 96 px from the top (12 px on phone). Input 52 high, 15 px, search icon at the left, placeholder "Search pages, members, actions…". Groups with overline headings: Pages, Actions (actions can show their shortcut as kbd). Footer hint: "↑↓ to move · Enter to open · Esc to close". First result highlighted. `role="dialog"`, `aria-label="Command palette"`.

### Inverted surfaces: toast, tooltip, save bar

Ink background (`--text`) with `--bg` text, so they read as system feedback in both themes.

| Component | shadcn | Spec |
|---|---|---|
| Toast | `Sonner` | Bottom centre, 24 from the bottom, max width 440, padding 12 16, radius 12, `--shadow-float`. One line + optional action ("Undo", underlined, weight 600). `role="status"`. Not for errors that need action: use a banner or inline error |
| Tooltip | `Tooltip` | 12/16, padding 6 8, radius 8, below the trigger with 6 px gap. Shown on hover and keyboard focus. Mandatory on icon-only buttons; text equals the `aria-label` |
| Save bar | custom | Sticky 16 above the bottom of the page, centred, padding 12 12 12 16, radius 12, `--shadow-float`. "2 unsaved changes" + Discard (outlined in `--bg`) + Save (filled `--bg`, text `--text`). `role="region"`, `aria-label="Unsaved changes"` |

## Layout

Shell, sidebar, topbar and page head are not catalogued yet.

### Card screen

Custom (`CardScreen` in `packages/ui/src/layout/`). The layout of the [card screens](patterns.md#public-pages-and-auth): sign in and its code, choose and create a company, accept an invitation, return from checkout.

- Anatomy: a page header with the worKampo logo (later the company's, and the language selector at its right before sign-in), then one `Card` with the screen's `h1` title and its task; nothing else on the page.
- Sizes: `--chrome` background at every size; header and card 384 px wide at most, centred; padding 24 at the top on phone and 64 from 640 px; 16 px from the screen edges on phone, where the card keeps its border and radius and sits at the top so the keyboard does not cover it.
- Accessibility: the header is the `banner` landmark and the card sits in `main`; the title is the page's only `h1`.

## Brand

### Logo mark in ink

Custom. The minimal logo (`logo-mono-*.svg` in [brand/](brand/)) inlined as an SVG filled with `currentColor` on `--text`, so it follows the theme: the circle with the K, the arc and the dot cut out. Sizes: 40 px in empty states, 48 px in the app loader, 56 px on system pages. Decorative: `aria-hidden="true"`, the text next to it carries the meaning. Never in colour inside the app: no orange dot, which would read as a warning (`--warn`) or a notification.
