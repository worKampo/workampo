# Runbook: deploy

How `apps/api` reaches staging and production. Decisions: [ADR-0013](../adr/0013-ci-cd-with-github-actions.md), [ADR-0033](../adr/0033-expand-contract-migrations.md). Environments and URLs: [platform.md](../platform.md). Undo a bad deploy: [rollback.md](rollback.md).

Anything that depends on resources not created yet is marked "(pending: first deploy)".

## How a deploy happens

`scripts/deploy/deploy.mjs <stg|prod> [--all]` is the only way to deploy. CI and people run the same script.

### Automatic

On every push to `master`, [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml):

1. Job `stg` (GitHub Environment `stg`, no approval): `node scripts/deploy/deploy.mjs stg`, then the smoke against `app-stg`, then a "Staging verification" comment on the ticket issue.
2. Job `prod` (GitHub Environment `prod`): waits for the person's approval, then does the same for prod. The comment is "Release verification".

### Manual, all Workers

[`.github/workflows/deploy-all.yml`](../../.github/workflows/deploy-all.yml) is run by hand with an environment input and runs `node scripts/deploy/deploy.mjs <env> --all`: no diff, every Worker is deployed.

### By hand

Needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the environment, plus `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT` if the source maps must reach Sentry. Never write them to a file; never paste them in chat, issues or commits.

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
   5. `wrangler deploy dist/index.js --no-bundle --env <env> --tag <sha> --message "<message>"`: it deploys the bundle Sentry knows, not a rebuild.

The SHA in `/health` comes from the deploy tag (`CF_VERSION_METADATA.tag`). If the tag turns out empty after the first stg deploy, the fallback is `--var GIT_SHA:<sha>` with the same `/health` contract (pending: first deploy).

## Read what is deployed

```sh
curl -s https://app-stg.workampo.workers.dev/health
curl -s https://app.workampo.workers.dev/health
# {"status":"ok","sha":"<git sha>","version":"<worker version id>"}

cd apps/api
npx wrangler deployments status --name app-stg
npx wrangler deployments status --name app
```

`sha` is the commit; `version` is the Worker version id that `wrangler rollback` takes. Both URLs answer only after the first deploy (pending: first deploy).

## Tokens and permissions

Tokens never enter the repo ([AGENTS.md](../../AGENTS.md#8-no-entra-public-repo)).

| Token | Where it lives | Permissions |
| --- | --- | --- |
| Cloudflare deploy token, one per environment | GitHub Environment secret `CLOUDFLARE_API_TOKEN` in `stg` and in `prod` | Account: `Workers Scripts: Edit`, `D1: Edit`, `Account Settings: Read` |
| Sentry auth token, one per environment | GitHub Environment secret `SENTRY_AUTH_TOKEN` | `project:releases` only |
| Cloudflare provisioning token | Nowhere: created, used in one terminal and revoked within a day ([ADR-0064](../adr/0064-local-secrets.md)) | `D1: Edit`, `Workers KV Storage: Edit` |

GitHub Environment variables (not secrets): `CLOUDFLARE_ACCOUNT_ID`, `SENTRY_ORG`, `SENTRY_PROJECT`.

Worker secret per environment: `SENTRY_DSN`, set from `apps/api` with `npx wrangler secret put SENTRY_DSN --env <env>` (pending: first deploy).

Cloudflare cannot scope a token to one Worker or database, and both environments share one account. The separation between stg and prod is who holds the secret and the person's approval on `prod`, not a Cloudflare boundary. `Account Settings: Read` is kept until the first stg deploy shows whether it is needed; update this table with what that deploy shows (pending: first deploy).

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

After the prod deploy a verifier reviews new Sentry errors, Worker metrics and the SLOs; a clean window lets the ticket close ([ADR-0020](../adr/0020-ticket-lifecycle.md)). ADR-0020 sends the length of the window to this runbook: **it is not decided yet.** Contract migrations also wait one window ([ADR-0033](../adr/0033-expand-contract-migrations.md)).
