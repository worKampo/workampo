# Runbook: rollback

Return a Worker to a previous version. Decisions: [ADR-0013](../adr/0013-ci-cd-with-github-actions.md), [ADR-0033](../adr/0033-expand-contract-migrations.md), [ADR-0039](../adr/0039-operations-and-incidents.md). Deploys: [deploy.md](deploy.md).

Target: the previous version serving in under 5 minutes from the decision.

## Command

From `apps/api`, with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the environment:

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

`/health` must answer `status: "ok"` with the `sha` and `version` of the target. Then check Sentry for new errors in that release.

`master` still holds the bad commit, and the next push deploys it again: revert it or fix forward before merging anything else. For SEV1 and SEV2 open an incident issue ([ADR-0039](../adr/0039-operations-and-incidents.md)).

## Rehearsals

The first rehearsal is task T9 of the ticket (pending: first deploy).

| Date | Environment | From SHA | To SHA | Duration |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |
