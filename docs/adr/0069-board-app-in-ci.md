---
status: accepted
date: 2026-11-20
related: [41, 64, 68]
---

# ADR-0069: A board-only GitHub App moves cards from CI

## Context

Workflows close tickets ([ADR-0068](0068-close-tickets-without-a-release.md) at the end of a staging deploy with no Worker, the observation window of [ADR-0020](0020-ticket-lifecycle.md)) with `github.token`. That token cannot have a permission on an organization board, so the card stays in its column and the job only warns (#45 and #46 after PR #49). Moving it needs a token of a GitHub App with the organization permission Projects. The key of the agents' App lives only on the person's machine ([ADR-0064](0064-local-secrets.md)); a key in CI can mint tokens with every permission of its App, whatever the token is cut down to.

## Decision

Decided by the person in issue #50 (2026-11-20, moment 1, option B).

- **A second GitHub App only for the board** (`workampo-board`): one organization permission, Projects: Read and write; no repository permission, no webhook. If its key leaks, only the board can be changed.
- **Its key in CI**: repository secret `BOARD_APP_PRIVATE_KEY`, and its client ID in the repository variable `BOARD_APP_CLIENT_ID`. Only `deploy.yml` and `observation-window.yml` read them. The deploy runs on pushes to `master`; the observation window runs on schedule from `master` and by hand from the branch the person picks. Running a workflow by hand needs write access, which can already read any repository secret from a workflow of its own, so it adds no reach; the agents' App can neither change nor run workflows. No protected Environment: with a board-only App it adds little, and the hourly observation job would create a deployment each run.
- **Token per job**: the step that closes tickets first mints an installation token with `actions/create-github-app-token`, scoped to `permission-organization-projects: write`, and passes it as `BOARD_TOKEN`. Closing and commenting stay with `github.token`; `pnpm work`'s `moveCard` uses `BOARD_TOKEN` only for the board calls.
- **Without the secret** the ticket still closes and the job warns that the card is left by hand.
- The agents' App key stays where ADR-0064 puts it; it never goes to CI.

## Consequences

- A ticket closed by a workflow ends with its card in Done, with no manual step.
- One more key to rotate: once a year or at any doubt, like the agents' App ([deploy runbook](../runbooks/deploy.md#board-app)).
- Creating the App, installing it on the organization and setting the secret and the variable are manual steps of the person.
