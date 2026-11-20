# Plan · Ticket #46

## Flow today

- `deploy.yml`, job `stg`: `deploy.mjs stg` writes `deployed=true|false` and `from=` to `GITHUB_OUTPUT`. `deployed=false` covers two different cases: no Worker affected since the SHA staging serves, and a stale run (a later commit on master changes a Worker).
- Job `prod` runs only when staging deployed something. The observation window (`scripts/observation/check.mjs`) judges only prod deploys, so a ticket whose merges touch no Worker never closes.

## Design

1. `deploy.mjs` tells the two cases apart: a new output `observe=none` only when the run is current and no Worker is affected. A stale run writes nothing new: its commits travel with the later deploy and its window.
2. New script `scripts/deploy/close-unobserved.mjs <sha> [<from>]`:
   - Tickets: `Refs: #N` of the commits `from..sha` (reuses `parseRefs` and `messagesLogArgs`).
   - Skips a closed ticket and a ticket with any commit on master (up to `sha`) that affects a Worker (turbo, the same query as `deploy.mjs`): that ticket waits for its observation window.
   - Otherwise comments "Sin Workers afectados: nada que observar" with a marker `<!-- no-workers:<sha> -->` and closes the issue as completed. One failure does not stop the rest (`postComments`).
3. `deploy.yml`, job `stg`: a step after the deploy, `if: steps.deploy.outputs.observe == 'none'`, with `GH_TOKEN: github.token` (the job already has `issues: write`). The person commits and pushes this file.
4. Docs: dated notes in the `## Updates` of ADR-0020 and ADR-0060; deploy runbook (new subsection next to the observation window).

## Waves

- W1: `deploy.mjs` output + tests (deploy.test.mjs).
- W2: `close-unobserved.mjs` + tests (pure functions with a fake io, like `deploy.test.mjs`).
- W3: docs (ADR notes, runbook).
- W4 (person): `deploy.yml` step.

## After the merge

- #46's own merge changes no Worker: if the workflow step is in that push, the stg run closes #46 itself (the first real test).
- #45 was merged before this existed: close it by hand with `pnpm work close 45`.
