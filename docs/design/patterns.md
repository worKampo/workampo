# Patterns

How components combine into screens. Component details are in [components.md](components.md); copy rules in [content.md](content.md).

## App shell

| Device | Layout |
|---|---|
| Desktop (≥ 1024) | Sidebar 256 px on `--chrome` + main column. The sidebar collapses to a **rail** of 64 px (icons only, tooltips on each item) with the collapse button in its foot. |
| Tablet and phone (< 1024) | No sidebar. **Topbar** 56 px, sticky, on `--chrome`: menu button, company logo + name, spacer, search, notifications, avatar. The menu button opens the sidebar **off-canvas** (280 px from the left, `--shadow-drawer`, over the scrim). |

Sidebar, top to bottom (company app):

1. **Workspace button**: company logo, name and the user's role; opens the company picker. `aria-label="Switch company, current: {company}"`.
2. **Search** (kbd Ctrl K) and **Notifications** (count).
3. **Main nav** (`<nav aria-label="Main">`): exactly **Home**, **Public page**, **Settings**. Active item: `aria-current="page"`, `--nav-active` surface with a 1 px border, weight 600.
4. **Foot**: plan usage bar ("Members 4 of 5"), trial row with Upgrade link, Help, **user button** (avatar, name, email), collapse button (desktop only).

Backoffice: same shell and style. Workspace button shows the product with a STAFF tag; nav: Companies, System health, Audit log; no usage or trial rows.

Main column: page content max 1280 px (editors 880 px), padding 24 and `clamp(16px, 3vw, 32px)` at the sides, 64 at the bottom, gap 24 between blocks. Phone: padding 16 12 48, gap 16.

Shell accessibility (lessons from the previous project's UI audit):

- A **"Skip to content"** link is the first focusable element and jumps to `<main>`.
- Every page sets a **unique `<title>`**: `{page} · {company} · worKampo` (public pages: `{page} · worKampo`).
- Controls revealed on hover (row actions, copy buttons) also appear on **`:focus-within`**, and are **always visible on touch** devices.
- Sticky table columns and headers have an **opaque background**, so scrolled content never shows through.

## Navigation

- **Settings** opens its first page. Settings pages have a **subnav**: General, Members & roles, Billing. Desktop: a 200 px column left of the content (gap 32). Touch: a horizontal, scrollable row above the content. The sidebar keeps Settings as current on every settings page.
- **Breadcrumb** only on second-level pages (`Settings / Members & roles`), above the `h1`. Never on top-level pages (Home, Public page).
- **My account** (profile, language, theme, sessions) is reached from the **user button** (sidebar foot, topbar avatar) through a menu: My account, Sign out. It is not in the main nav.
- **Notifications**: the sidebar item (topbar bell on touch) opens a panel; a popover on desktop, a full-height sheet on tablet and phone. Tabs Unread / All, "Mark all as read", each item links to the related page.
- **Command palette** on every app and backoffice screen (see components).
- Every navigation is a real link (`<a href>`): open in new tab and back/forward must work.

## Page head

`h1` on the left with an optional meta line under it ("6 people · 4 seats left on your plan"); actions on the right.

- **One primary** text button (Invite members).
- **Secondary page actions are icon-only** secondary buttons with a tooltip (Export CSV, Copy invite link).
- On phone the actions wrap under the title.

## Lists

Order on the page: KPIs → saved view row → toolbar → bulk bar (when selecting) → table / card list → pager.

| Part | Rule |
|---|---|
| KPIs that filter | KPI cards are buttons; pressing one applies its saved view (Members, Owners and admins, Pending invitations). A KPI that is not a filter is a plain card. |
| Saved views | A views button ("All members ▾") opens a menu of views. When the user changes filters or search, show the **Edited** pill and a ghost **Save view** button. Choosing a view resets filters and selection. |
| Search + filter chips | Search input (max 320 px) and filter chips in a wrapping toolbar. Chips are toggles (`aria-pressed`). |
| Filters on touch | A single "Filters" chip (with the active count) opens a **bottom sheet** with the chips, "Clear" and "Show N members". |
| Rendering | Desktop: table. Touch: card list with the same data and actions. |
| Selection | Checkboxes per row + select all; the bulk bar appears while any row is selected. |
| No results | Empty state "No members match" with "Clear filters"; distinct from the first-use empty state. |
| URL state | View, search, page and sort live in the URL: `?view=&q=&page=&sort=`. Reload, back and shared links restore the same list. Default values are omitted from the URL. An open drawer is also in the URL so it can be shared. |

## Forms

- **Labels above** the field; help text under the field, linked with `aria-describedby`.
- Group related fields in a card with an `h2`; two columns on wide screens via an auto-fit grid (min 240 px), one column on phone.
- **Validation**: on blur for format errors, on submit for everything. Error under the field (what is wrong and how to fix it), `aria-invalid`. On submit with errors: a negative banner at the top with a **summary** linking to each field, and focus moves to it.
- **Submit button** stays enabled; it shows a busy state while saving and prevents double submit.
- **Edit-in-place settings** (General, Public page): no Save button per section. Any change shows the inverted **save bar** ("N unsaved changes · Discard · Save"). Leaving the page with unsaved changes asks for confirmation. Success: toast; failure: banner + field errors, edits kept.
- **Create flows** (Create company, Invite members): normal form with a primary submit and Cancel.

## Drawers vs dialogs

| Use a drawer when | Use a dialog when |
|---|---|
| Viewing or editing **a record** while keeping the list in context (member detail, company detail in the backoffice) | A **short decision** that blocks: confirm, choose, type DELETE |
| Content is long, has tabs (View / Edit) or sections | Content fits one screen with 1–3 fields |
| The user may move between records | The user returns to exactly where they were |
| State belongs in the URL (shareable) | Transient; not in the URL |

Never stack a drawer on a drawer; a dialog may open over a drawer (e.g. remove member). On phone the drawer is full width and the dialog is a bottom sheet. The touch filters sheet is a dialog.

## Destructive actions

- Destructive settings live in a **danger zone** at the bottom of the page or drawer: a card with `--neg-border` borders, each row = title, consequence text, **danger outline** button.
- The button label names the action and object and ends in an ellipsis when another step follows ("Remove Marc…").
- The confirmation dialog states **what is lost and what is not** ("Marc loses access immediately… His account and other companies are not affected").
- **Irreversible** or high-impact actions (remove member, delete company) require typing **DELETE**: field labelled "Type DELETE to confirm"; the **danger** button stays disabled until it matches exactly.
- Reversible actions use a toast with Undo instead of a confirmation.

## Screen states

Every screen specifies these states (D31 Specify):

| State | Pattern |
|---|---|
| Ready | Normal content |
| Empty (first use) | Empty state explaining what will appear and the action to create the first item |
| Empty (no results) | Empty state with Clear filters |
| Loading | Skeleton of the real layout, after ~300 ms; no full-page spinners. The only exception is the app loader (components), while there is no layout yet |
| Error | Negative banner (or the error page) saying what failed and what to do, with Retry; data already loaded stays visible |
| No access | Explain that the user's role cannot see it and who can grant access; never a blank page |
| Long data / unicode | Names truncate with ellipsis and full text in a tooltip or the detail; RTL and long words do not break the layout |

**System pages** (centred card on `--chrome`, same layout as auth pages, with a link home; the logo mark in ink above the title, the code as a meta line "Error 404" under the text): 404 Page not found, 403 No access, 500 Something went wrong, Maintenance (with expected end time when known). The 500 page shows the error reference id.

**Error reference**: 500 pages and unexpected-error banners show a short reference id ("Reference: 7F3K-92QD") with a copy button. The same id is in the server logs and Sentry so support can find the event; it contains no personal data.

## New version available (D59)

- When a newer version is deployed, the next navigation reloads the page at the same URL. The user sees no message.
- Never reload while the save bar is visible; wait until the user saves or discards.
- A tab left open for hours shows a quiet `info` banner: "A new version is available · Reload".
- A failed load of a screen's code reloads once; if it fails again, show the 500 page with its reference.
- Emergency only (minimum version): a blocking dialog "Reload to continue", with a single primary button.

## Long-running work (D56)

When an action starts work that takes more than a few seconds (export, import, delete a company):

- The action returns at once: a toast "We're processing it. We'll let you know when it's ready." and the action shows its state (badge `info` "Processing" with progress when known) where it was started.
- The user can leave the page; nothing is lost.
- On finish: an in-app notification that links to the result (and an email if it took long). On failure: a negative banner on the same place with what failed, the error reference and Retry.
- Starting the same action twice while it runs is not possible: the control shows "Processing" and is disabled.
- The client polls the job status with increasing intervals and stops when the page is hidden.

## Staff session (D50)

When staff enters a company ("Enter as"):

- An **amber banner** (`banner-staff strip`, `role="status"`) across the top of the main column on **every page**, never dismissible: "Viewing as staff", staff name, **countdown** ("47:12 left"), the reason, **Enable editing…** and **Exit session**.
- Read-only by default: write controls keep their place but are `aria-disabled` with the tooltip "Read-only session".
- **Enable editing…** opens a dialog that asks for its own reason; while editing is enabled the banner says so.
- The workspace button shows "Viewing as staff" instead of the role.
- The backoffice shows the active session too. Amber is used for nothing else in the app except warnings.

## Responsive

| Device | Width | Behaviour |
|---|---|---|
| Desktop | ≥ 1024 | Sidebar (or rail), tables, centred dialogs, right drawers, 36 px controls |
| Tablet | 834 (design width) | **Behaves like phone**: topbar + off-canvas, card lists, Filters sheet, 44 px controls |
| Phone | 420 (design width) | Same as tablet plus: bottom-sheet dialogs, full-width drawers, tighter page padding, hidden secondary header links |

In Tailwind, `lg:` (1024) is the single layout breakpoint; below it the touch layout applies. Content still adapts fluidly inside each range (`grid-cols` auto-fit, wrapping toolbars). Public pages (Astro) follow the same breakpoints.

## Dark mode

- All colours come from tokens; components never hardcode colours. `.dark` on `<html>` switches the token set.
- **User preference** in My account: Light / Dark / **System** (default). System follows `prefers-color-scheme` and reacts to changes live. The choice is stored per user and applied before first paint to avoid a flash.
- The app and the backoffice follow the preference above. **Marketing pages and each company's public page are light only**: they do not follow `prefers-color-scheme` (ADR-0070). Forced colours still work.
- Check both themes in Verify (D31).

## Commercial emphasis (ADR-0070)

Colour in the app means data, status or a business moment. A business moment uses `--commercial` (the logo's sky), never green or orange: they read as "OK" and "warning".

- **Where**: the end of a trial ("Trial · N days left"), "Upgrade", the recommended plan, a "New" badge for a feature.
- **At most one per screen.** If two compete, the one closer to the user's task wins and the other stays ink.
- **Shape**: a fill (`--commercial` with `--on-commercial` ink text), a band (`--commercial-bg`) or a 2 px ring (`--commercial-border`). Never a small badge alone: that shape is `--info`.
- Text in the colour only with `--commercial-text`, and only where a fill or ring is not possible.
- Primary buttons, links, focus and selection stay ink. A primary "Upgrade" button is ink; the band or ring around it carries the emphasis.

## Marketing pages (ADR-0070)

The worKampo landing, pricing, the marketing site and help or changelog pages that sell. Sign in, create company and a company's public page are not marketing pages.

- Free use of the logo palette (`--brand-sky`, `--brand-green`, `--brand-orange` and their tints), illustration and graphic resources, without overdoing it: **one accent per section**, and the primary button stays ink.
- Text on a fill: ink on sky (7.43:1) and orange (6.63:1), white on green (4.57:1; ink on green is 4.13:1, below AA). Sky and orange are never text on a light background; green only on white.
- **Light only**, WCAG 2.2 AA, and light pages: static HTML (Astro), no image or video that slows the first load.

## Public pages and auth

- Landing and marketing (Astro): `--bg` white, header with logo, nav, Sign in / Get started; on phone the nav collapses into a menu button.
- **Card screens** (sign in and its code, choose and create a company, accept an invitation, return from checkout): a card with modal look on `--chrome` at every size; on phone it keeps its border and radius, 16 px from the screen edges, and sits at the top so the keyboard does not cover it (the person, 2026-11-22; this replaces "full screen on phone" of D7).
  - The card holds only its task. The logo goes in a page header above it (the worKampo logo, or the company's inside a company), and before sign-in the language selector goes at the right of that header.
- **No third-party scripts** (analytics, chat) on `/login` (D32); the font is self-hosted.
