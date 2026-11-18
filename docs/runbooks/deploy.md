# Runbook: deploy

How `apps/api` reaches staging and production. Decisions: [ADR-0013](../adr/0013-ci-cd-with-github-actions.md), [ADR-0033](../adr/0033-expand-contract-migrations.md). Environments and URLs: [platform.md](../platform.md). Undo a bad deploy: [rollback.md](rollback.md).

The first deploy ran on 2026-11-17 (PR #29, SHA 78bfcff): staging served the new SHA 1 minute after the merge, and production 40 seconds after the approval.

## How a deploy happens

`scripts/deploy/deploy.mjs <stg|prod> [--all]` is the only way to deploy. CI and people run the same script.

### Automatic

On every push to `master`, [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml):

1. Job `stg` (GitHub Environment `stg`, no approval): `node scripts/deploy/deploy.mjs stg`, then the smoke against `app-stg`, then a "Staging verification" comment on the ticket issue.
2. Job `prod` (GitHub Environment `prod`): waits for the person's approval, then does the same for prod. The comment is "Release verification".

### Manual, all Workers

[`.github/workflows/deploy-all.yml`](../../.github/workflows/deploy-all.yml) is run by hand with an environment input and runs `node scripts/deploy/deploy.mjs <env> --all`: no diff, every Worker is deployed.

### By hand

Needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the environment, plus `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT` if the source maps must reach Sentry, and `SENTRY_DSN` so the Worker reports errors (without it Sentry stays off). Never write them to a file; never paste them in chat, issues or commits.

```sh
node scripts/deploy/deploy.mjs stg          # only the Workers affected since the deployed SHA
node scripts/deploy/deploy.mjs prod --all   # every Worker, no diff
```

Run it from the SHA you want to deploy. Without an environment the script refuses; the top-level `wrangler.jsonc` config is `app-local` and never reaches a real Worker.

Without `SENTRY_AUTH_TOKEN` the deploy still works and logs that the source maps were not uploaded. With it, `SENTRY_ORG` and `SENTRY_PROJECT` are required.

## What the script does

1. Parses the arguments: an explicit `stg` or `prod`, optionally `--all`.
2. Reads the HEAD SHA. Unless `--all`, it picks the Workers to deploy: it reads the SHA served by the environment's `/health` and asks Turborepo which Workers changed between that SHA and HEAD. Docs-only changes deploy nothing; a change in a shared package deploys every Worker that depends on it. If `/health` is unreachable, does not answer 200, or its SHA is not a known commit, every Worker is deployed.
3. Builds the deploy message: `#<PR> <short sha>` (the PR number comes from the `(#N)` at the end of the commit subject), or just the short SHA.
4. For each Worker:
   1. Applies D1 migrations to every database of `env.<env>.d1_databases` (`wrangler d1 migrations apply <db> --env <env> --remote`), before the new code ([ADR-0033](../adr/0033-expand-contract-migrations.md)). With no migrations it is a no-op.
   2. `wrangler deploy --dry-run --outdir dist --upload-source-maps` builds the bundle and writes the `.map` files.
   3. With `SENTRY_AUTH_TOKEN`: `sentry-cli sourcemaps inject` and `sourcemaps upload --release <sha>` to `https://de.sentry.io` (EU region). The release is the full SHA.
   4. Deletes every `.map` from `dist`.
   5. `wrangler deploy dist/index.js --no-bundle --env <env> --tag <sha> --var GIT_SHA:<sha> --message "<message>"`: it deploys the bundle Sentry knows, not a rebuild.

The SHA in `/health` comes from the deploy tag (`CF_VERSION_METADATA.tag`); if the tag is empty, `/health` and the Sentry release use the `GIT_SHA` var that every deploy also sets, so the contract holds either way.

## Read what is deployed

```sh
curl -s https://app-stg.workampo.workers.dev/health
curl -s https://app.workampo.workers.dev/health
# {"status":"ok","sha":"<git sha>","version":"<worker version id>"}

cd apps/api
npx wrangler deployments status --name app-stg
npx wrangler deployments status --name app
```

`sha` is the commit; `version` is the Worker version id that `wrangler rollback` takes.

## Tokens and permissions

Tokens never enter the repo ([AGENTS.md](../../AGENTS.md#8-no-entra-public-repo)).

| Token | Where it lives | Permissions |
| --- | --- | --- |
| Cloudflare deploy token, one per environment | GitHub Environment secret `CLOUDFLARE_API_TOKEN` in `stg` and in `prod` | Account: `Workers Scripts: Edit`, `D1: Edit`, `Account Settings: Read` |
| Sentry organization token (`deploy-workampo`), the same in both environments | GitHub Environment secret `SENTRY_AUTH_TOKEN` | Organization token (scope `org:ci`: releases and source maps). It embeds the address `sentry.io`, so `sentry-cli` uses it instead of `de.sentry.io` and prints a warning; the upload still reaches the EU organization |
| Cloudflare provisioning token | Nowhere: created, used in one terminal and revoked within a day ([ADR-0064](../adr/0064-local-secrets.md)) | `D1: Edit`, `Workers KV Storage: Edit` |

GitHub Environment variables (not secrets): `CLOUDFLARE_ACCOUNT_ID`, `SENTRY_ORG`, `SENTRY_PROJECT`.

Environment variable `SENTRY_DSN` (not a secret: it only lets a client send events). The deploy script passes it with `--var` on every deploy; `wrangler secret put` is not used because it creates an untagged version and `/health` would lose the SHA.

Cloudflare cannot scope a token to one Worker or database, and both environments share one account. The separation between stg and prod is who holds the secret and the person's approval on `prod`, not a Cloudflare boundary. The first deploy worked with exactly these permissions; whether `Account Settings: Read` can be dropped is untested.

The agents' App cannot approve deployments or edit workflows ([ADR-0041](../adr/0041-agent-boundaries.md)).

## When the smoke fails

`node scripts/smoke/smoke.mjs <url> <sha>` calls `GET <url>/health` every 10 seconds for up to 3 minutes and passes on 200, `status: "ok"` and the expected SHA. Each attempt prints its reason.

| Reason printed | Likely cause | Do |
| --- | --- | --- |
| `request failed` or `status 5xx` | The Worker does not serve, or fails at start | Check Sentry and `wrangler deployments status`; roll back if it is prod |
| `status 404` | Wrong URL, or the Worker was not deployed | Check the URL in `project.yaml` and the deploy log |
| `sha is ..., expected ...` | No Worker was affected so nothing deployed, the deploy failed after migrating, or the tag is not exposed | Read the deploy job log; if the tag is empty, use the `--var GIT_SHA` fallback |

Then:

1. In stg: do not promote. Fix forward with a new PR, or roll back ([rollback.md](rollback.md)) if stg must serve the previous version.
2. In prod: roll back first, investigate after. A migration that already ran is not reverted: the previous code must work with it ([ADR-0033](../adr/0033-expand-contract-migrations.md)).
3. Severity and incident process: [ADR-0039](../adr/0039-operations-and-incidents.md).

## Release observation window

After the prod deploy a verifier reviews new Sentry errors, Worker metrics and the SLOs; a clean window lets the ticket close ([ADR-0020](../adr/0020-ticket-lifecycle.md)). ADR-0020 sends the length of the window to this runbook: **24 hours** from the prod deploy (decided by the person on 2026-11-17; revisit in the monthly review once there is real traffic). Contract migrations also wait one window ([ADR-0033](../adr/0033-expand-contract-migrations.md)).

### How it is checked

[`.github/workflows/observation-window.yml`](../../.github/workflows/observation-window.yml) runs every hour (minute 17) and by hand, with `node scripts/observation/check.mjs`. It is a deterministic script, not an AI agent.

1. Reads the GitHub deployments of the `prod` Environment. A deploy is due when its success status is at least 24 hours old.
2. Its tickets are the `Refs: #N` trailers of the commits between the previous prod deploy and this one. It skips a closed ticket and a ticket that already has a comment with `<!-- observation-window:<sha> -->` by the workflow, the agents' App or the project account.
3. Three signals:
   - Sentry: issues of the organization whose first release is that SHA, in the `prod` environment. None is clean.
   - UptimeRobot: the monitor of the prod `/health`. Clean if it is up and its 1-day uptime is at least 99.9%.
   - `/health` serves that SHA. If prod already serves a newer deploy, the window is judged on Sentry and UptimeRobot only.
4. Clean: comment "Observation window clean" and close the ticket as completed. Otherwise: comment "Observation window: needs the person" with the findings and leave it open; the person closes it with `pnpm work close <n>`.

A missing secret leaves its signal "not checked", and the window is not clean. Sentry issues are listed by id and link only: their titles can carry user data and the issue is public.

To see the decisions without writing: `GH_TOKEN=$(node scripts/github/app-token.mjs) node scripts/observation/check.mjs --dry-run`.

GitHub disables a scheduled workflow after 60 days without activity in the repo. Any merge to `master` counts; re-enable it in the Actions tab if it was disabled.

### Secrets

Repository secrets (the scheduled job has no Environment), both read-only:

| Secret | What |
| --- | --- |
| `SENTRY_READ_TOKEN` | Token of a Sentry Internal Integration with Issue & Event: Read only. The `deploy-workampo` organization token cannot read issues |
| `UPTIMEROBOT_READ_KEY` | UptimeRobot's read-only API key |

`SENTRY_ORG` is a repository variable, not a secret.
