# Content

Rules for every user-visible text: app, backoffice, emails, public pages. Examples are in `en`; the same rules apply to every locale.

## Voice and tone

| Do | Don't |
|---|---|
| Plain, direct words: "Remove member" | Jargon or internal terms: "Revoke membership entity" |
| Sentence case: "Members & roles", "Save view" | Title Case: "Save View" |
| Calm, no exclamation marks: "Invitation sent" | "Invitation sent!" |
| Say what happened and what to do next | Only "Error" or "Something went wrong" |
| Neutral about fault: "That link has expired" | Blame: "You entered an invalid link" |
| Address the user as "you"; "we" only when the product itself failed | "The user must…" |
| Specific numbers and names: "Marc loses access immediately" | Vague: "This may affect access" |
| Short: one idea per sentence | Paragraphs in UI |

## Labels

- **Buttons start with a verb** and name the object when it is not obvious: "Invite members", "Save changes", "Export CSV", "Start read-only session".
- An **ellipsis** means another step follows (a dialog or form): "Remove Marc…", "Enable editing…".
- **Discard** drops unsaved edits; **Cancel** closes without acting; **Close** dismisses something informational.
- Icon-only buttons: the `aria-label` and tooltip are the same verb phrase ("Copy invite link").
- Links say where they go ("Update payment method"), never "click here".
- Navigation and headings are nouns: "Settings", "Billing", "Published versions".

## Error messages

Pattern: **what happened** + **what to do**. One or two short sentences.

| Context | Example |
|---|---|
| Field format | "Enter a complete email address." |
| Field limit | "Use at most 60 characters." |
| Conflict | "ana@northwind.example is already a member." |
| Action failed | "We couldn't save your changes. Check your connection and try again." |
| Permission | "Only owners can make someone an owner." |
| Unexpected | "Something went wrong on our side. Try again in a few minutes. Reference: 7F3K-92QD" |

- Field errors are instructions ("Enter…", "Use…", "Choose…"), not states ("Invalid email").
- Never show stack traces, codes without explanation, or internal ids other than the error reference.
- Never reveal whether an account exists on sign-in or invitation screens.

## Empty states

Title says **what is not there yet**; one line says **why it matters or what will appear**; one action.

| Kind | Title | Body | Action |
|---|---|---|---|
| First use | "No invitations pending" | "Invite teammates by email. They get a single-use link valid for 7 days." | Invite members |
| No results | "No members match" | "Try another search or clear the filters to see everyone in Northwind Logistics." | Clear filters |
| No access | "You don't have access to Billing" | "Ask an owner of Northwind Logistics to change your role." | Back to Home |

## Confirmations and feedback

- Toasts are past tense and specific: "Invitation sent to 3 people", "Invite link copied to clipboard". Offer "Undo" when it is possible.
- Destructive dialogs: title = the action ("Remove Marc Puig?"), body = what is lost and what is not, button = the action ("Remove member"), never "OK" or "Yes".
- Counts and status: "4 of 5", "Trial · 9 days left", "6 people · 4 seats left on your plan".

## Dates, numbers and money

- Always format with `Intl` in the active locale, never by hand (D47): `Intl.DateTimeFormat`, `Intl.RelativeTimeFormat` ("2 hours ago"), `Intl.NumberFormat` (numbers, percentages, currency with its code), `Intl.ListFormat`, `Intl.PluralRules` through the i18n library.
- Recent activity uses relative time; anything older than about a week or anything legal or financial (invoices, published versions) uses an absolute date. Show the absolute date and time in a tooltip on relative times.
- Store and send dates as ISO 8601 in UTC; display in the user's time zone.
- Numbers use tabular figures (already global in the tokens).

## Internationalisation (D47)

- `en` is the default; `es` (es-ES) and `ca` (Catalan) ship from day one. Adding a locale must not require code changes. Where Catalan is missing, Spanish is used; English only when neither exists.
- **No user-visible text in code**: every string goes through the i18n library with an **English key** `domain.screen.element` (ADR-0053; e.g. `companies.members.invite_button`). This includes `aria-label`, tooltips, `alt`, placeholders, toasts, emails and server error messages shown to users.
- Use the library's interpolation and **ICU plurals**; never concatenate translated fragments or build sentences from pieces ("Invite " + n + " people").
- Allow for expansion: Spanish is often 20–30 % longer than English. Buttons, chips and table headers must not truncate at that length.
- CI fails if a key is missing in any locale. Agents propose translations; they are reviewed in the PR.
- **Files and keys** (the person, 2026-11-22). Texts live in `packages/i18n/locales/<lang>/<domain>.json`, one i18next namespace per domain, nested by screen: `access.json` → `{ "login": {…}, "code": {…}, "home": {…}, "errors": {…} }`.
  1. **`errors` is the domain's error screen**: one key per error code of the domain (`access.invalid_code` → `access.errors.invalid_code`). A test checks that every code has its text in every language.
  2. **Repeated texts are repeated per screen**: each keeps its context, and Catalan or Spanish may need different forms in different places.
  3. **`common`** (`locales/<lang>/common.json`) holds only generic design-system words with the same meaning everywhere: actions (cancel, close, back, save, retry) and states (loading). When in doubt, the text stays in its screen.
  4. **Context for translators** in `locales/_context/<domain>.json` (and `common.json`), in English, with the same structure; the app does not load it. Every screen group has a `_screen` description; notes per key are optional (length, tone, variables). `pnpm check` fails when a screen group of `en` has no `_screen`.
- The active app locale is a user preference (then company default, then `Accept-Language`, then `en`); it is not in the app URL. Public pages carry the locale in the path (`/`, `/es/`).
- Company landings are in the language the company chooses; their content is the company's.

## Placeholders in designs

- Content that is not decided yet appears in designs in square brackets and capitals: `[YOUR PRICE]`, `[COMPANY LEGAL NAME]`. It marks a gap, not copy to ship.
- Sample people and companies use fictional names and `.example` domains (`lucia@northwind.example`).
- A bracketed placeholder must not reach production: replace it in the spec or the PR that implements the screen.
