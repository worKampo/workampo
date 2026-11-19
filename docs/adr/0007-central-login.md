---
status: accepted
date: 2026-11-10
---

# ADR-0007: Central login

## Context

The session must move from the central host to a company subdomain, the login page must stay free of third-party scripts, and company landings contain content written by the company.

## Decision

- **Decision**: login at `/login` on the central host. After authenticating: one company → direct redirect; several → selector.
- In `subdomain` mode, the session passes to the subdomain with a **one-time code**: lifetime ≤ 60 s, stored in `DB_GLOBAL`, invalidated when redeemed. `return_to` only accepts hosts of the same environment (prevents open redirect).
- In `path` mode login needs no exchange: everything is on the same host. The exchange is built in both modes anyway: the backoffice → app "Enter as" jump needs it ([ADR-0050](0050-enter-as-staff-impersonation.md)).
- The same exchange will serve future custom domains.
- **Entry point**: the corporate landing. "Sign in" and "Get started" lead to `/login`, a **page of its own that looks like a modal** (centered card on a neutral background, a close control that returns to the landing), not a modal inside the landing:
  - the password field never shares a page with third-party scripts (analytics, chat); `/login` carries a strict CSP and zero third-party scripts ([ADR-0032](0032-security-reviewer.md));
  - email links, an expired session and `return_to` need a login URL anyway;
  - the landing stays static Astro without the auth code (Lighthouse, [ADR-0031](0031-ui-ux-designer.md)).
- **Never a login form on a company landing** (content written by the company, [ADR-0032](0032-security-reviewer.md)): its "Sign in" leads to the central login with `return_to`.

## Consequences

See Decision.

## More information

Resolves §3 and §4.4 vs §39 of the original spec.
