---
status: accepted
date: 2026-11-14
---

# ADR-0013: CI/CD with GitHub Actions

## Context

In the previous project, a `deploy` without an environment could overwrite the production Worker with another database. Waiting time matters more than cost for CI (minutes are free on a public repo, [ADR-0043](0043-public-repo.md)).

## Decision

- Runs on every PR (not only on push).
- **Fast CI** (2026-11-14): waiting time matters more than cost (minutes are free on a public repo, [ADR-0043](0043-public-repo.md)).
  - Only on PRs (`on: pull_request`): pushing a branch without a PR, as a backup, triggers nothing. CI starts with `pnpm work pr`.
  - `concurrency` with `cancel-in-progress` per PR: with two pushes in a row only the last one counts.
  - Only what is affected: tests, typecheck and lint of the packages and apps that changed, with the Turborepo cache in Actions. With no changes in apps, no E2E; with changes, only the E2E and acceptance scenarios of those apps ([ADR-0029](0029-testing-strategy.md)).
  - Parallel jobs: fast checks (lint, types, unit and integration) and E2E separately; E2E are split across several machines if they grow.
  - Local first: the hook runs `pnpm check` on what is affected and the agent runs the E2E before `pnpm work pr`. CI confirms, it does not discover.
  - PR review: the agent groups the fixes of each round (CodeRabbit comments, CI comments or findings of moment 2) and makes **one push per round**. The *squash* merge ([ADR-0023](0023-branching-and-deployment.md)) leaves a single commit on `master`.
  - Goal: CI response on a PR in under about 10 minutes, measured in [ADR-0040](0040-process-metrics-and-monthly-review.md). If exceeded, measure which part takes the time before changing anything.
- Migrates **all** the environment's D1 databases before deploying ([ADR-0033](0033-expand-contract-migrations.md)).
- Covers all apps, not only the API; each deployment includes only the Workers affected since what is already in the environment ([ADR-0060](0060-deploy-affected-workers-only.md)).
- Production protected with GitHub Environments: `prod` with a **required reviewer** (the person) and secrets per environment; Cloudflare tokens with minimum permissions, one per environment. Available because the repo is public ([ADR-0043](0043-public-repo.md)).
- **Environment names** (2026-11-14): in every technical identifier, `stg` and `prod`, always explicit (`wrangler.jsonc` environments and `--env`, GitHub Environments, `project.yaml` keys, workflow names). Internal Cloudflare resources are named `<resource>-<environment>`: `global-stg` / `global-prod`, `shard-1-stg` / `shard-1-prod`, `landings-stg` / `landings-prod`, `files-stg` / `files-prod`. Exception: production Workers have no suffix (`app`, `bo`) because their name is their public URL; the staging ones are `app-stg` and `bo-stg` (Wrangler adds the environment suffix by itself; in `prod` the name is fixed). In prose, "staging" and "production" are still used. A name without an environment would look like the default value, which is the trap the next rule avoids.
- `concurrency` so that two deployments do not migrate at the same time.
- **Safe deployment** (2026-11-13): nothing is ever deployed or migrated without an explicit `--env`; the base `wrangler.jsonc` configuration (no environment) does not point to production resources, and the deployment scripts fail if the environment is missing. In the previous project, a `deploy` without an environment could overwrite the production Worker with another database.
- Current Node LTS; pnpm version pinned in `packageManager`.
- Rollback: `wrangler rollback` to any of the last 100 versions; it does not revert data or schema (hence [ADR-0033](0033-expand-contract-migrations.md)).
- Workers Builds (native CI) is ruled out: we stay with GitHub Actions because of the PR checks, the migration of several databases and the production approval.

## Consequences

- Rollback does not revert data or schema (hence [ADR-0033](0033-expand-contract-migrations.md)).
- **Ruled out**: Workers Builds (native CI).
- If the CI response goal of about 10 minutes is exceeded, the slow part is measured before changing anything.

## More information

Resolves §43–44 of the original spec.
