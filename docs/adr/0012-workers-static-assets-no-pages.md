---
status: accepted
date: 2026-11-10
---

# ADR-0012: Workers + Static Assets, no Pages

## Context

Pages does not support wildcard domains; the wildcard needs a Worker anyway.

## Decision

- **Decision**: the `app` Worker serves landing (KV), SPA, marketing and help (Static Assets) and API in a single deployment. The backoffice is a second Worker (`bo`, [ADR-0048](0048-separate-backoffice-worker-and-account-limits.md)) on the same D1 databases.
- The builds of `apps/web` (SPA) and `apps/marketing` (corporate website and help) are copied into the Static Assets of the `app` Worker.
- **Why**: Pages does not support wildcard domains; the wildcard needs a Worker anyway. API and SPA always ship in the same version and rollback is a single one.
- Assets are free and unlimited; 20,000 files per version on Free, 25 MiB per file. `run_worker_first` decides which routes go through the Worker first.

## Consequences

See Decision.

## More information

Resolves §2.1 and §17.1 of the original spec.
