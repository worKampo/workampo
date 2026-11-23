---
status: accepted
date: 2026-11-10
---

# ADR-0047: Internationalization from the start

## Context

The earlier policy (UI in Spanish, i18n deferred) is replaced. This decision supersedes it in the vision and in [ADR-0036](0036-language-and-glossary.md).

## Decision

All the interface, the emails and the public content are multilingual from day one. **`en` by default, `es` (es-ES) and `ca` (Catalan) from the start** (the person, 2026-11-22); adding a language does not require touching code. Where a text, email or provider has no Catalan, Spanish is used; English only when neither exists (the person, 2026-11-22).

- **Active language in the app**: user preference → the company's default language → `Accept-Language` → `en`. It is not in the app URL (it is a preference; URLs stay shareable).
- **Public pages** (marketing, help, changelog, legal): language in the path (`/`, `/es/`) with `hreflang` ([ADR-0031](0031-ui-ux-designer.md)).
- **Company landings**: in the language each company chooses (one per landing in v1); the content is theirs.
- **Texts**: English keys in code, translation files in the repo; no user-visible text written in code. CI fails if a key is missing in any language. Agents propose translations and they are reviewed in the PR.
- **Formats**: dates, numbers and currency with `Intl`, never by hand.
- **Emails** (Brevo): one template per language, sent in the recipient's language.
- **Library**: undecided; candidates are Paraglide (compiled, typed, no runtime cost; serves Vite and Astro), Lingui and react-i18next. It is chosen and verified in the Discover step of "Access and first company".

## Consequences

See Decision.

## Updates

- 2026-11-23 (the person, ticket 135): the i18n library is decided in [ADR-0073](0073-frontend-stack-and-rate-limiting.md): i18next.
