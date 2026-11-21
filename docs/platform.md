# Platform

Where worKampo runs and how it is watched. Profile with accounts and secrets: [project.yaml](../project.yaml).

## Environments

|                    | local                          | stg                                    | prod                               |
| ------------------ | ------------------------------ | -------------------------------------- | ---------------------------------- |
| Worker             | `app-local` (top-level config) | `app-stg`                              | `app`                              |
| URL                | `http://localhost:8787`        | `https://app-stg.workampo.workers.dev` | `https://app.workampo.workers.dev` |
| D1 `DB_GLOBAL`     | `global-local`, local only     | `global-stg`                           | `global-prod`                      |
| D1 `DB_SHARD_1`    | `shard-1-local`, local only    | `shard-1-stg`                          | `shard-1-prod`                     |
| KV `LANDINGS`      | local only                     | `landings-stg`                         | `landings-prod`                    |
| GitHub Environment | none                           | `stg` (automatic)                      | `prod` (the person approves)       |

- The stg and prod databases and namespaces are created with `--jurisdiction eu` by `scripts/cloudflare/provision.mjs`. Their IDs go in `apps/api/wrangler.jsonc` (not secrets). Provisioned on 2026-11-17.
- Both environments share one Cloudflare account. The top-level config is local only, so a deploy without `--env` cannot reach a real Worker ([ADR-0013](adr/0013-ci-cd-with-github-actions.md)).
- `GET /__debug/error` throws, to prove Sentry. It exists only when `ENABLE_DEBUG_ERROR` is `"true"` (stg); in prod it is 404.

## Pipelines

| Pipeline                                                | Trigger                   | What                                                                                                                                                                  |
| ------------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`deploy.yml`](../.github/workflows/deploy.yml)         | Push to `master`          | Job `stg`: `deploy.mjs stg`, smoke, "Staging verification" comment. Job `prod`: the person's approval, then the same for prod with a "Release verification" comment |
| [`deploy-all.yml`](../.github/workflows/deploy-all.yml) | Manual, environment input | `deploy.mjs <env> --all`                                                                                                                                              |

Step by step: [deploy runbook](runbooks/deploy.md).

## Observability

- **Sentry**: organisation in the EU region (`https://de.sentry.io`), Free plan ([ADR-0063](adr/0063-eu-data-residency.md)). `release` is the commit SHA, `environment` is `stg` or `prod`. PII is off in the SDK and on the server. The DSN is the GitHub Environment variable `SENTRY_DSN` (not a secret: it only lets a client send events), passed with `--var` on every deploy. Source maps go only to Sentry ([ADR-0043](adr/0043-public-repo.md)).
- **Alerts**: one Sentry alert, `all envs: new, regressed or escalating issue`, on project `node-cloudflare-workers`, All Environments: email to the person (owner of the Sentry account) when an issue is created, a resolved issue regresses or an issue escalates, at most once every 5 minutes per issue. The email names the environment. One rule because Sentry only offers environments that have sent events, and prod had none when it was created (2026-11-21); split it per environment if stg gets noisy. Created by the person in Sentry's UI on 2026-11-21. The regression email was proved on stg: mark the `/__debug/error` issue plain "Resolved" (not "Resolved in next release", which waits for a new release), then hit `/__debug/error`. No volume alert yet: without real traffic there is no meaningful threshold.
- **Logs**: Workers logs. The only request data added is `X-Client-Version`.
- **Uptime**: UptimeRobot Free, one HTTP monitor per environment on `/health`, every 5 minutes, email alert ([ADR-0039](adr/0039-operations-and-incidents.md)). Created on 2026-11-17; a deliberate DOWN on a missing path proved the email alert.
- **Deployed version**: `/health` returns `sha`, `version` and `environment` (`local`, `stg` or `prod`).

## SLOs

From [ADR-0039](adr/0039-operations-and-incidents.md); reviewed with real data.

| SLO              | Target         |
| ---------------- | -------------- |
| API availability | 99.5 % monthly |
| API latency      | p95 < 500 ms   |

## Free plan limits that apply now

From [ADR-0048](adr/0048-separate-backoffice-worker-and-account-limits.md).

| Limit                      | Free              | Scope                | Use today                                                                                                                          |
| -------------------------- | ----------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Workers                    | 100               | Account              | 2 (`app`, `app-stg`)                                                                                                               |
| Requests                   | 100,000 a day     | Account, all Workers | Shared by environments, smoke and monitor (about 600 a day). Static Assets requests do not count; `run_worker_first` matches do    |
| D1 databases               | 10                | Account              | 4                                                                                                                                  |
| D1 database size           | 500 MB            | Each database        | empty                                                                                                                              |
| KV writes                  | 1,000 a day       | Account              | none yet                                                                                                                           |
| Cron triggers              | 5                 | Account              | 0                                                                                                                                  |
| Subrequests and D1 queries | 50 per invocation | Request              | not reached                                                                                                                        |

## Runbooks

- [Deploy](runbooks/deploy.md)
- [Rollback](runbooks/rollback.md)
