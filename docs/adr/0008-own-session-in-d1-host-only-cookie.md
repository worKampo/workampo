---
status: accepted
date: 2026-11-13
---

# ADR-0008: Own session in D1, host-only cookie

## Context

Lesson from the previous project: having WorkOS as the source of truth forced non-atomic double writes and patches for out-of-order events.

## Decision

- **Decision**: WorkOS only authenticates. We issue a random session ID stored in `DB_GLOBAL` (expiry and revocation) and send it in a `__Host-` cookie (no Domain attribute), `HttpOnly`, `Secure`, `SameSite=Lax`. No token in `localStorage`.
- **Why**: instant revocation (global logout, expulsion, company deactivation); no theft by XSS; production cookies do not travel to staging; we do not depend on WorkOS sealed-session helpers working in workerd (not confirmed).
- The mobile app (deferred) will use `Authorization: Bearer` against the same sessions table. A single middleware resolves the session from the cookie or the header; for now only the cookie is implemented ([ADR-0057](0057-ready-for-a-mobile-app.md)).
- **WorkOS only as identity** (2026-11-13): it verifies who the person is and nothing more. Companies, members, roles and invitations live in our database, which is the source of truth. WorkOS Organizations, memberships and roles are not used, nor are they mirrored into D1 via webhooks. The user is created in `DB_GLOBAL` on first login. Account deletion is handled by our flow ([ADR-0027](0027-legal-and-data-protection.md)), which also deletes it in WorkOS. Lesson from the previous project: having WorkOS as the source of truth forced non-atomic double writes and patches for out-of-order events.

## Consequences

See Decision.

## More information

Resolves §22 of the original spec.
