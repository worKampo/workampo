PRD #10 · Ticket #158 · Branch: feature/158-un-solo-despliegue-a-prod-esperando

## Seams and sharing

No provider, no shared rule, no text and nothing for app-core: a CI job and a deploy script.

## Change

- `deploy.yml` gets a `supersede` job after `stg` (when it deployed): `node scripts/deploy/supersede.mjs` lists this workflow's runs in `waiting` status (waiting for the prod Environment approval, checked against a real waiting run) and cancels those older than this run.
- The `deploy-prod` concurrency group and its `queue: max` stay: `deploy-all` and `backfill` share it and are other workflows, so they are never cancelled, and a backfill still never overlaps a migration.
- Why every older one is already waiting: the `deploy-stg` group is FIFO, so earlier runs finish staging before this one.

## Risks

- Cancelling the wrong run: only runs of `deploy.yml`, only in `waiting`, only with a smaller id; unit-tested.
- The job failing: `continue-on-error`, so the deploy goes on and at worst one more run waits.

## Security

`actions: write` only in the new job, with `github.token`; checkout without persisted credentials.
