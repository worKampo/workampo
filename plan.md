PRD #4 · Ticket #7 · Branch: feature/7-deploy-and-observability

Design for deploying `apps/api` to staging and production on `workers.dev`, with the deployed SHA in `/health`, Sentry, an uptime monitor and a rehearsed rollback. Facts come from the current Cloudflare, Sentry and monitor docs (research of 2026-11-17).

## Environments and resources

|                               | local                   | stg                                    | prod                               |
| ----------------------------- | ----------------------- | -------------------------------------- | ---------------------------------- |
| Worker                        | `app-local` (top level) | `app-stg`                              | `app`                              |
| URL                           | `http://localhost:8787` | `https://app-stg.workampo.workers.dev` | `https://app.workampo.workers.dev` |
| D1 `DB_GLOBAL` / `DB_SHARD_1` | local only              | `global-stg` / `shard-1-stg`           | `global-prod` / `shard-1-prod`     |
| KV `LANDINGS`                 | local only              | `landings-stg`                         | `landings-prod`                    |
| GitHub Environment            | —                       | `stg` (automatic)                      | `prod` (person approves)           |

- `apps/api/wrangler.jsonc`: top-level `name: "app-local"` with local-only bindings, so a deploy without `--env` cannot overwrite production (Wrangler only warns); `env.stg.name: "app-stg"` and `env.prod.name: "app"` explicit (otherwise Wrangler names it `app-prod`). Bindings repeated per environment (not inherited). `compatibility_flags: ["nodejs_compat"]` (needed by Sentry). `version_metadata` binding `CF_VERSION_METADATA` per environment. `upload_source_maps: false`: maps go only to Sentry (ADR-0043).
- D1 with `migrations_dir` pointing at `packages/db/migrations/global` and `.../shard` (folders keep their `.gitkeep`: `migrations apply` fails if the folder is missing, and logs "No migrations to apply" if empty).
- D1 and KV are created with `--jurisdiction eu`. IDs are not secrets; they live in `wrangler.jsonc` (ADR-0045).

## API contracts

- `GET /health` → `200 {"status":"ok","sha":"<git sha>","version":"<worker version id>"}`. The SHA comes from the deploy tag (`wrangler deploy --tag <sha>`, read from `CF_VERSION_METADATA.tag`); locally `sha` is `"local"`. If the tag turns out empty after the first stg deploy, fall back to `--var GIT_SHA:<sha>` (same contract).
- Middleware: logs `X-Client-Version` when present (one JSON log line, no other request data); sets `X-App-Version` only when `APP_VERSION` is defined, which happens once the SPA exists (ADR-0059).
- Stg only: `GET /__debug/error` throws, to prove Sentry; it exists only when `ENABLE_DEBUG_ERROR` is `"true"`, set in `env.stg.vars`. In prod the route is 404.

## Migrations

No schema yet. The deploy applies `wrangler d1 migrations apply <db> --env <env> --remote` to every database of the environment's `d1_databases`, before the Worker (ADR-0033). With no migrations it is a no-op; the step is in place for the first PRD that adds tables.

## Deployment

`scripts/deploy/deploy.mjs <stg|prod> [--all]`, the only way to deploy, used by CI and by hand:

1. Refuses without an explicit environment (ADR-0013).
2. Reads the SHA deployed in that environment from its `/health`. Computes the affected Workers with Turborepo between that SHA and the target SHA (`--filter=...[<deployed sha>]`): docs-only changes deploy nothing; a change in `packages/domain` deploys every Worker that depends on it. `--all` skips the diff (manual "deploy all" workflow, ADR-0060). With an unreachable `/health` (first deploy), it deploys everything.
3. Migrates every D1 database of the environment.
4. Builds with `--dry-run --outdir dist`, uploads the source maps to Sentry with release = SHA, then deletes them; fails if any `.map` is left in an assets folder.
5. `wrangler deploy --env <env> --tag <sha> --message "#<PR> <sha>"`.

Workflows:

- `deploy.yml`, on push to `master`: job `stg` (Environment `stg`) runs `deploy.mjs stg`, then the smoke against `app-stg`, then posts "Staging verification" on the ticket's issue (found from the `Refs: #N` trailer). Job `prod` (Environment `prod`, waits for the person) deploys the same SHA, with its own diff against the SHA deployed in prod, then a read-only smoke and "Release verification". `concurrency: deploy` without cancel, so two deploys never migrate at once.
- `deploy-all.yml`, manual, with an environment input: `deploy.mjs <env> --all`.
- Permissions: `contents: read`, `issues: write` (comments). Actions pinned by SHA.
- The agents' App cannot edit workflows, so the person pushes the commits that add them.

Smoke (`scripts/smoke/smoke.mjs <url> <sha>`): `/health` answers 200 with the expected SHA. Staging also runs the living-spec examples once they exist (none yet).

## Observability

- **Sentry**: `@sentry/hono` with `@sentry/cloudflare`; `release` = SHA, `environment` = `stg` or `prod`; organisation in the EU region (Frankfurt, cannot be changed later, ADR-0063). PII off in the SDK (`dataCollection` with user info, cookies, headers, bodies, query and frame variables disabled) and on the server (default scrubbing plus "Prevent storing of IP addresses"). Free Developer plan.
- **Logs**: Workers logs; only `X-Client-Version` is added.
- **Uptime monitor**: UptimeRobot Free, two HTTP monitors on `/health` every 5 minutes, email alerts. About 600 requests a day, against 100,000.

## Security

- **Tokens**: one Cloudflare token per GitHub Environment (`stg`, `prod`), with Account permissions `Workers Scripts: Edit`, `D1: Edit`, `Account Settings: Read`. Cloudflare cannot scope a token to one Worker or database and both environments share one account, so the separation is who holds the secret and the `prod` approval, not a Cloudflare boundary. Sentry auth token, also per Environment, only with `project:releases`. Provisioning token (`D1: Edit`, `Workers KV Storage: Edit`) lives one day (ADR-0064). Nothing is printed or written to disk.
- **Approvals**: prod deploys wait for the person; the App cannot approve Environments or edit workflows (ADR-0041).
- **Wrong environment**: `deploy.mjs` refuses without one; the top-level config is local only.
- **Data**: no personal data in logs, Sentry or the monitor. The debug error route exists only in stg.
- **Source maps**: never in Cloudflare (`upload_source_maps: false`) nor in public assets; only in Sentry.

## Risks

| Risk                                                               | Mitigation                                                          |
| ------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `--tag` not exposed in `CF_VERSION_METADATA` for `wrangler deploy` | Checked on the first stg deploy; fall back to `--var GIT_SHA`       |
| `Account Settings: Read` not needed, or another permission missing | First stg deploy with the minimum; adjust and record in the runbook |
| Rollback blocked if a bound KV was deleted in between              | Never delete a bound resource; noted in the rollback runbook        |
| First deploy has no deployed SHA                                   | Deploy everything when `/health` is unreachable                     |
| Free plan: 100,000 requests a day for the whole account            | Static Assets do not count; monitor adds about 600 a day            |

## Decisions to approve

1. **KV in the EU**: create `landings-*` with `--jurisdiction eu`. ADR-0063 says KV cannot be limited to the EU; the current docs say it can (durable storage only; the cache can be anywhere). Proposed: a line in ADR-0063 that says it was verified on 2026-11-17 and applied. The rule "never personal data in KV" stays.
2. **Monitor**: UptimeRobot Free (commercial use allowed, 5-minute checks, email). It does not publish where it stores data; it receives only the two public `/health` URLs and the alert email, the same minimal exposure ADR-0063 accepts for WorkOS. Proposed: record the choice in ADR-0039 and the monitor in the sub-processor list.
3. **Static Assets quota (ADR-0048 ⚠)**: resolved by the docs: asset requests are free and do not count; requests matched by `run_worker_first` do. Proposed: a line in ADR-0048.

## Out of scope

The assets pipeline of `apps/web` and `apps/marketing` (they do not exist yet; ADR-0012 applies when they do) and staging smoke for living-spec examples (none yet).
