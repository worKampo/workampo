---
status: accepted
date: 2026-11-10
---

# ADR-0005: Dual `resolveTenant()` by configuration

## Context

workers.dev does not support wildcard subdomains (verified) and no free Cloudflare hostname does. workers.dev is on the Public Suffix List: cookies are not shared between Workers, so production and staging stay isolated without doing anything.

## Decision

- **Decision**: a single `resolveTenant()` function with a mode per environment (`TENANT_ROUTING`):
  - `path` (no own domain, workers.dev): the company is in the path.
  - `subdomain` (with own domain): the company is the subdomain.
- Membership is always validated. A header sent by the client is never trusted.
- **Only the slug is stored in the database**, never a host or a URL. The host is derived and built from the environment configuration (`TENANT_ROUTING`, `TENANT_HOST_SUFFIX`, `PUBLIC_BASE_URL`):
  - `resolveTenant(request)`: host or path → slug (`acme-stg.workampo.com` → `acme`).
  - `tenantUrl(slug, path)`: slug → absolute URL of the environment. It is the only way to generate links (emails, redirects, canonical, sitemap, SPA).
  - Each environment has its own database: `acme` in staging is a different company, not a copy.
  - Future exception: custom domains, where the hostname is data (hostname → company table).
- Both modes are tested from the start, including `tenantUrl()` with every configuration combination.
- **Why**: workers.dev does not support wildcard subdomains (verified) and no free Cloudflare hostname does.
- workers.dev is on the Public Suffix List: cookies are not shared between Workers, so production and staging stay isolated without doing anything.

## Consequences

See Decision.

## More information

Resolves §8 (`X-Tenant-ID` without validation) of the original spec.
