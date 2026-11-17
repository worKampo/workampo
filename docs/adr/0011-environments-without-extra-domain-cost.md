---
status: accepted
date: 2026-11-10
---

# ADR-0011: Environments without extra domain cost

## Context

Universal SSL (free) covers the apex and one level; a second level requires Advanced Certificate Manager, which is paid.

## Decision

- **Without own domain**: each environment is its own Worker on workers.dev. The format is fixed, `<worker>.<account subdomain>.workers.dev`: the account subdomain carries the product name and the Workers are called `app` and `app-stg` (`app.workampo.workers.dev`, `app-stg.workampo.workers.dev`).
- **With own domain**: staging uses a suffix on the label within the same domain:

| | Production | Staging |
|---|---|---|
| Company | `acme.workampo.com` | `acme-stg.workampo.com` |
| Marketing / login | `workampo.com` | `stg.workampo.com` |
| Backoffice (own Worker, [ADR-0048](0048-separate-backoffice-worker-and-account-limits.md)) | `bo.workampo.com` | `bo-stg.workampo.com` |

- The slug is obtained by removing a suffix configured per environment. No slug may end in `-stg`.
- Worker routes: `*.workampo.com/*` **and** `workampo.com/*` (the wildcard does not include the apex) with a proxied wildcard DNS record. Workers Custom Domains do not support wildcards.
- **Why**: Universal SSL (free) covers the apex and one level; a second level requires Advanced Certificate Manager, which is paid.

## Consequences

See Decision.

## More information

Resolves §2.1 of the original spec.
