# Runbook: rollback

Return a Worker to a previous version. Decisions: [ADR-0013](../adr/0013-ci-cd-with-github-actions.md), [ADR-0033](../adr/0033-expand-contract-migrations.md), [ADR-0039](../adr/0039-operations-and-incidents.md). Deploys: [deploy.md](deploy.md).

Target: the previous version serving in under 5 minutes from the decision.

## From the Cloudflare dashboard (fastest)

Workers & Pages → `app` (or `app-stg`) → **Deployments** → the previous version → **Rollback**. No token needed: the person signs in with the project's Cloudflare account. Check the version's **Tag** first: it is the commit SHA. A rollback from GitHub Actions does not exist yet (#32).

## Command

From `apps/api`, with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the environment (a one-day token with `Workers Scripts: Edit`; `wrangler login` failed with a CSRF error in the rehearsal):

```sh
npx wrangler deployments list --name app
npx wrangler rollback [<version-id>] --name <app-stg|app> --message "<reason>"
```

Without `<version-id>` Wrangler goes to the previous version. `--name` is explicit on purpose: `app-stg` is staging, `app` is production. The message stays in the deployment history; write the reason with no personal data.

## What a rollback does not do

- It does not revert data or schema ([ADR-0033](../adr/0033-expand-contract-migrations.md)). The previous code runs against the current schema, which is why migrations are expand/contract. If the bad deploy included a migration, check that the previous version works with it before rolling back.
- It reaches only the last 100 versions. An older one needs a new deploy of that commit.
- It is blocked if a KV namespace bound by the target version was deleted in the meantime. Never delete a bound resource.

## Confirm

```sh
curl -s https://app.workampo.workers.dev/health   # stg: https://app-stg.workampo.workers.dev/health
npx wrangler deployments status --name app
```

`/health` must answer `status: "ok"` with the `sha` and `version` of the target. The switch takes a few seconds to reach every location: check again after about 30 seconds before concluding it failed. Then check Sentry for new errors in that release.

`master` still holds the bad commit, and the next push deploys it again: revert it or fix forward before merging anything else. For SEV1 and SEV2 open an incident issue ([ADR-0039](../adr/0039-operations-and-incidents.md)).

## Rehearsals

| Date | Environment | From SHA | To SHA | Duration |
| --- | --- | --- | --- | --- |
| 2026-11-17 | stg | 6639739 (version 69c1dce4) | 78bfcff (version 45cddac5) | Under 1 minute, including about 20 seconds until `/health` showed the target |
|  |  |  |  |  |
