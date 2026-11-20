---
status: accepted
date: 2026-11-14
---

# ADR-0060: Deploy affected Workers only

## Context

Deploying everything would change the version of every Worker on every deployment and would reload all app users even if only the backoffice had changed ([ADR-0059](0059-web-client-version.md)).

## Decision

**Decision** (2026-11-14): each deployment includes only the affected pieces, not everything.

- **Pieces that are deployed**:

| Piece | Content | Why it goes together |
|---|---|---|
| Migrations | `DB_GLOBAL` and shards (`packages/db/migrations`) | Shared by all Workers |
| Worker `app` | API + SPA + company landings + corporate website and help (`apps/marketing`, [ADR-0012](0012-workers-static-assets-no-pages.md)) | They share types (Hono RPC, [ADR-0019](0019-typed-contract-with-hono-rpc.md)) and origin ([ADR-0006](0006-same-origin-route-map.md)) |
| Worker `bo` | Backoffice ([ADR-0048](0048-separate-backoffice-worker-and-account-limits.md)) | — |

- **How it is decided**:
  1. It is compared with **what is deployed in that environment** (the SHA of each `/health`), not with the previous commit: several merges since the last deployment count together.
  2. **Turborepo** computes the affected apps from the monorepo graph: a change in `packages/domain` or `packages/ui` affects its consumers; lockfile, root configuration and `wrangler.jsonc` are declared global dependencies and affect everything.
  3. **Migrations always first** if something changed in `migrations/`, even if no Worker is deployed ([ADR-0013](0013-ci-cd-with-github-actions.md), [ADR-0033](0033-expand-contract-migrations.md)).
  4. **Production receives only what was tested on staging**: it computes its own diff against the SHAs deployed in production, up to the SHA already validated on staging. That way nothing is lost even if production is several deployments behind.
- **Versions per Worker**: each Worker carries the SHA it was built with (`app` at `a1b2` and `bo` at `c3d4` is correct). They can coexist because Workers do not call each other and the database is compatible with the previous version ([ADR-0033](0033-expand-contract-migrations.md)). [ADR-0059](0059-web-client-version.md) only reloads app users if the SPA build changed; a change to the corporate website alone redeploys `app` without reloading anyone.
- **Safety nets**:
  - Manual **"deploy everything"** workflow (🧑) for doubts or recovery.
  - The smoke test always runs **against all Workers**, deployed or not, to detect cross effects.
  - Rollback per Worker (`wrangler rollback`) with its runbook; a migration is not undone, it is fixed forward ([ADR-0033](0033-expand-contract-migrations.md)).
  - The "Staging verification" and "Release verification" comments say what was deployed and with which SHA.

## Updates

- 2026-11-20: a staging deploy with no Worker affected emits `observe=none` and closes the merge's tickets, which have no release to observe ([ADR-0068](0068-close-tickets-without-a-release.md)).

## Consequences

See Decision.
