# Patterns

How components combine into screens. Component details are in [components.md](components.md); copy rules in [content.md](content.md).

## App shell

`AppShell` ([components](components.md#app-shell)) is the layout of `/c/$slug`: every company page renders inside it, "Page not found" too, with no item current. The shell lays out the same on every device: the page shows only what it needs, and everything else is in the sidebar, with the user at its bottom (ticket 196).

| | Sidebar (desktop) | Rail (desktop, collapsed) | Tablet and phone (< 1024) |
|---|---|---|---|
| Company | Top of the sidebar, with the collapse button in the same row | Avatar at the top of the rail; on hover the rail unfolds with the name and «Fijar menú lateral» | In the topbar |
| Search | In the sidebar, with `Ctrl K` / `⌘K` | Icon | In the side menu |
| Notifications | Item under Search, with a red count | Icon with a red dot | Bell in the topbar, with a red dot |
| User | At the bottom, with the account menu | 44 px avatar at the bottom, the account menu to its right | At the bottom of the side menu, the account menu upwards |
| Topbar | None | None | Menu button, company and bell; no avatar |

**The shell shows only what exists.** An item whose PRD has not shipped is not rendered, not hidden by CSS. In the MVP: the company, Home and the user. The shell has places for search and notifications, but they render only when their feature exists; Public page, Settings, plan usage, trial, Help and My account wait for their PRDs too.

**Desktop (≥ 1024)**: a sidebar of 256 px or a rail of 64; no topbar, so the page starts 24 px from the top. Top to bottom (company app):

1. **Company row**: the company button and the collapse button. The company button has the company logo (the [Avatar](components.md#avatars) initials palette), name and the user's role under it; it links to `/companies`, the company picker, and the shell does not load the company list.
2. **Search** (kbd `Ctrl K` / `⌘K`) and **Notifications** (count): come with their PRD.
3. **Main nav** (`<nav aria-label="Main">`): exactly **Home**, **Public page**, **Settings** (Public page and Settings come with their PRD).
4. **Foot**: plan usage bar ("Members 4 of 5"), trial row with Upgrade link, Help (these three come with their PRD) and the **user button** (avatar, name, email) last.

Backoffice: same shell and style. Company button shows the product with a STAFF tag; nav: Companies, System health, Audit log; no usage or trial rows.

- **Active item**: a soft tint (`--nav-active`, a little stronger than hover), the label in weight 600 `--text` and `aria-current="page"`; no border, ring or shadow, so counts and chevrons at its end stay free. The same in the rail and in inner items. It never relies on colour alone.
- **Rail**: icons only. Labels are visually hidden, not removed, so each item keeps its accessible name; no tooltips. An icon navigates with one click, without waiting for the rail to unfold. The choice is stored per browser in `localStorage` (`workampo:sidebar`) and the sidebar starts expanded. Per user arrives with My account (Post-MVP).
- **The rail unfolds on hover**: after about 300 ms with the mouse over it, it unfolds to 256 px floating over the page, with `--shadow-drawer-start`; the page does not move. It folds 300 ms after the mouse leaves. With reduced motion it appears without animation.
- **Pin and collapse**: one button in the company row that changes with the state. On the floating rail it is «Fijar menú lateral»: the sidebar stays expanded and pushes the page. In its place, the pinned sidebar shows «Plegar menú lateral».
- **Keyboard on the rail**: the rail unfolds when the focus enters it with Tab, and folds when the focus leaves or with Esc. After Esc it stays folded until the focus leaves the rail. Only keyboard focus holds it open: a click leaves the focus inside, yet the rail folds when the mouse leaves.
- **Held open by its menus**: while the account menu or the notifications panel is open the rail does not fold; it folds when they close. With the account menu open, the first Esc closes only the menu.
- **Touch screens on desktop** (`hover: none`, such as a landscape iPad): «Desplegar menú lateral» stays visible under the company avatar, the only case with a button. It opens the floating rail with «Fijar» inside, like hover; a tap outside or Esc folds it.
- **Tablet and phone (< 1024)**: no sidebar, no rail and no collapsed state. **Topbar** 56 px, sticky, on `--chrome`: menu button, company logo + name, the notifications bell when it exists; no avatar. The menu button opens the **side menu**.
- **Side menu**: 280 px from the start edge, `--shadow-drawer-start`, over the scrim; a modal dialog with exactly the content of the expanded sidebar, except Notifications, which is the topbar bell. «Cerrar menú» sits in the company row, where the collapse button is on desktop; the user is at the bottom, and its account menu opens upwards. On open the focus goes to the company link and stays trapped inside; on close it returns to "Open menu". It closes with Esc, the scrim, the close button, choosing an item, or when the window reaches 1024 px. Controls are 44 px.
- **Short windows**: the company row and the user stay fixed and the middle (Search, Notifications, the nav and the future foot rows) scrolls. A hairline `--border` separates the user while the middle scrolls.
- **Safe areas**: `apps/web/index.html` sets `viewport-fit=cover`, so `env(safe-area-inset-*)` has a value. The topbar adds the top inset and both sides, the page both sides, and the side menu the start side and the bottom one under the user.
- **Tab order on desktop**: "Skip to content", company, collapse or pin, Search, Notifications, the nav, the user and the page.
- **Background**: flat `--chrome` in light and dark, the main column too, so the whole page is grey in light and black in dark. Cards, tables, panels and popovers sit on `--surface`.
- **Areas**: the area tree selector (ticket 73, [ADR-0072](../adr/0072-organization-units-and-scoped-roles.md)) is not in the shell. It goes in the head of each page scoped to a unit; company pages do not show it. The sidebar stays the company's.
- **Long names**: one line with an ellipsis. In the expanded sidebar the tooltip of the company and user names appears only when the text is cut, on hover and on focus; the accessible name is always the full one. Every name has `dir="auto"`.
- **Accepted departures from the mockup**: no chevron on the company button and no icon on "Sign out".
- **User menu (MVP)**: a non-interactive header with the name and email (the email alone when there is no name), a separator and "Sign out", which goes to `/login`. While signing out the menu stays open and the item is busy; a failure shows an inline error in the menu with `role="alert"`, and the user can retry.
- **App loader**: only while there is no layout. A static copy lives in `#root` of `apps/web/index.html` (React replaces it on mount) and the [AppLoader](components.md#app-loader) is the `pendingComponent` (`pendingMs: 300`) of the root route and of `/c/$slug` only. The static copy's `aria-label` is "worKampo", because static HTML cannot be translated. Inside a page, a skeleton.
- **Theme before first paint**: `apps/web/public/theme.js`, a classic synchronous script in `<head>`, sets `.dark` from `prefers-color-scheme` and follows its changes. It is a file and not inline because the CSP (`apps/web/public/_headers`) is `script-src 'self'`; for the same reason the static loader's styles live in `styles.css`.

Main column: max 880 px, padding 24 and 32 at the sides, 64 at the bottom, gap 24 between blocks. Phone: padding 16 12 64, gap 16.

Shell accessibility (lessons from the previous project's UI audit):

- A **"Skip to content"** link is the first focusable element and jumps to `<main id="content" tabindex="-1">`.
- Every page sets a **unique `<title>`**: `{page} · {company} · worKampo` (public pages: `{page} · worKampo`). Each page gives its name with `useDocumentTitle(page)` (`apps/web/src/_shared/document-title/`) and the shell adds the company.
- Controls revealed on hover (row actions, copy buttons) also appear on **`:focus-within`**, and are **always visible on touch** devices.
- Sticky table columns and headers have an **opaque background**, so scrolled content never shows through.

## Navigation

- **Settings** opens its first page. Settings pages have a **subnav**: General, Members & roles, Billing. Desktop: a 200 px column left of the content (gap 32). Touch: a horizontal, scrollable row above the content. The sidebar keeps Settings as current on every settings page.
- **Breadcrumb** only on second-level pages (`Settings / Members & roles`), above the `h1`. Never on top-level pages (Home, Public page).
- **My account** (profile, language, theme, sessions) is reached only from the **user button** at the bottom of the sidebar or the side menu, through a menu: My account, Sign out. It is not in the main nav. Until My account ships, the menu is the [MVP one](#app-shell).
- **Notifications**: on desktop, a nav item under Search with the unread count, named "Notifications, 3 unread"; its panel opens to the right of the sidebar, as a popover. In the rail, an icon with a dot. On tablet and phone, the topbar bell with a dot opens a full-height sheet. Tabs Unread / All, "Mark all as read", each item links to the related page. New notifications are not announced live: only the number changes.
- **Unread count and dot**: `--neg` with the number in `--on-neg` (AA), since `--ui` is black or white and does not stand out. Red on a badge means only "unread", never "error"; if the two ever clash, a `--badge` token that points to `--neg` today.
- **Collapsible sections** (when the nav has them): only first-level items have an icon (Home, Search, Notifications and each section), since the rail shows only icons; inner items are text only, indented to the section's text. A section is a button with `aria-expanded` and a chevron at its end; it does not navigate. Several can be open; the one holding the current page opens by itself, and each remembers whether it was open. A collapsed section holding the current page gets the active tint. The rail shows only first-level icons and unfolds with the sections on hover; on touch, tapping a section's icon unfolds the rail with that section open. Whether a section can also have its own page is decided with the first real section.
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
- **Validation**: on blur for format errors, on submit for everything. Error under the field (what is wrong and how to fix it), `aria-invalid`. On submit with errors: a negative banner at the top with a **summary** linking to each field, and focus moves to it. A short form on a Card screen has no summary: focus moves to the first field with an error.
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

**System pages** (centred card on `--chrome`, same layout as auth pages, with a link home; no logo in the card, the header already has the colour logo; the code as a meta line "Error 404" under the text; component: [SystemPage](components.md#system-page)): 404 Page not found, 403 No access, 500 Something went wrong, Maintenance (with expected end time when known). The 500 page shows the error reference id.

**Error reference**: 500 pages and unexpected-error banners show a short reference id ("Reference: 7F3K-92QD") with a copy button. The same id is in the server logs and Sentry so support can find the event; it contains no personal data.

## New version available (D59)

Every API answer says which version of the SPA is deployed (`X-App-Version`, a hash of the SPA's files) and, in an emergency, the oldest build still allowed (`X-Min-Client-Version`, the ISO date of that build). The client compares them with its own build; it never uses either value as a destination.

- **E1 reload on the next navigation.** When a newer version of the SPA is deployed, the next navigation to another screen reloads the page at its destination, which is always a path of the app. The user sees no message, only the first-load app loader if it takes more than 300 ms. At most one reload per new version, and only on a navigation: never from a timer or an answer.
- **E2 nothing changed for the SPA.** A deploy that does not touch the SPA's files keeps the same version, so navigating does not reload.
- **E3 never over unsaved changes.** While the save bar is visible there is no reload and no notice; the first navigation after the user saves or discards reloads.
- **E4 a failed code load.** When a screen's code fails to load, the page reloads once, without a message. If it fails again, the 500 page of [components.md](components.md#system-page) shows, without a reference line: the failure is the browser's and the server has no event for it.
- **E5 notice after 30 minutes.** 30 minutes after a new version is detected without navigating, a floating notice shows «Hay una versión nueva» with «Recargar» (`Banner variant="info"` with the `floating` modifier). Once at the root route, after the screen: fixed at the bottom centre, 24 px from the edge, max width 440, opaque, over the shell and every card screen, never on the system pages. It cannot be closed: closing it would keep the old version, and the next navigation reloads anyway. It stays until the page reloads (its button or the next navigation) and hides while the save bar is visible. Its `role="status"` container is always in the DOM; it never takes the focus and is the last stop in the tab order.
- **E6 minimum version.** When an answer brings a minimum later than the date of the user's build, a blocking `AlertDialog` shows «Recarga para continuar», «Hay una versión nueva de worKampo y esta ya no se puede usar.» and one primary button «Recargar», busy (`aria-busy`) until the page unloads. Only that button closes it: Esc, the scrim and a click outside do nothing, and it has no close button. It shows on every screen except the system pages, also while the save bar is visible, and it wins over the E5 notice. On a phone it is a bottom sheet with a full-width 44 px button.
- **E7 the build travels with every call.** Every API call carries the build's version in `X-Client-Version`.

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
| Tablet | 834 (design width) | **Same as phone**: topbar + side menu, no sidebar or rail, card lists, Filters sheet, 44 px controls |
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
