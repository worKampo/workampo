---
status: accepted
date: 2026-11-10
---

# ADR-0006: Route map on the same origin

## Context

Landing, app and API are served together, and the backoffice must be separated from the app for security ([ADR-0048](0048-separate-backoffice-worker-and-account-limits.md)).

## Decision

| Mode | Landing | App (SPA) | API |
|---|---|---|---|
| `path` | `/l/:slug` | `/c/:slug/*` | `/api/t/:slug/*` |
| `subdomain` | `acme.domain/` | `acme.domain/app/*` | `acme.domain/api/*` |

- Same origin for landing, app and API: no CORS. The SPA computes its base path at startup (`/c/:slug` in path mode, `/app` in subdomain mode).
- **Backoffice in its own Worker and its own host**, separated from the app for security ([ADR-0048](0048-separate-backoffice-worker-and-account-limits.md)): `bo.workampo.workers.dev` / `bo-stg.workampo.workers.dev` without a domain; `bo.workampo.com` / `bo-stg.workampo.com` with a domain. Subdomain mode is used only for companies.
- Marketing at `/` (path mode) or at the apex (subdomain mode). Login at `/login`. Help at `/docs` ([ADR-0025](0025-user-help-with-starlight.md)). Legal at `/legal/*` ([ADR-0027](0027-legal-and-data-protection.md)).

## Consequences

See Decision.

## More information

Resolves §2.1 of the original spec.
