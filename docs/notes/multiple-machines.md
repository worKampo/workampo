# Working on multiple machines

> Status: deferred, from decision D55 of the former decisions log. Proposal for the future (2026-11-14), not part of the PRD "Working foundation". It is picked up before starting to work on a second machine. It only covers the person on several machines; another developer joining is out of scope.

- **Principle**: a new machine is ready with a single script and almost no secrets on disk.

| What | How it is synced |
|---|---|
| Code and docs | Git: pull at the start, push at the end. `PROGRESS.md` is committed ([ADR-0016](../adr/0016-procedure-harness.md)), so half-done work passes from one machine to another |
| Local development secrets (`.dev.vars`) | Single source in the manager of [ADR-0064](../adr/0064-local-secrets.md) (Bitwarden, with CLI); `pnpm secrets:pull` regenerates `.dev.vars` and warns if a key from `.dev.vars.example` is missing |
| Access (`gh`, `wrangler`, SSH) | Not copied: registered on each machine (`gh auth login`, `wrangler login`, one SSH key per machine, all in the GitHub account). If a machine is lost, only that one is revoked |
| What lives outside the repo | Private repo `worKampo/business` (set in [ADR-0043](../adr/0043-public-repo.md); folders to be decided when picked up) with the prototype and an idempotent bootstrap script |

- **Few local secrets**: with the fake login, the fake services and the captured emails, local development works almost without real secrets. Those for staging and production are on no machine: they live in Cloudflare and in the GitHub Environments ([ADR-0041](../adr/0041-agent-boundaries.md)). Never encrypted secrets in the public repo.
- **Bootstrap script** (`setup.ps1`): installs Node (`.nvmrc`) and pnpm with Corepack; writes the git identity per folder (`includeIf` with the *noreply*, `hooksPath`, SSH alias); generates the machine's SSH key and shows the public one; runs `gh auth login`, `wrangler login` and the password manager login; runs `pnpm secrets:pull` and `pnpm doctor`.
- **`pnpm doctor`** in the repo: checks the Node version, the git author with the *noreply*, the `gh` and `wrangler` accounts according to `project.yaml`, installed hooks and the keys of `.dev.vars`; if something fails, it says the command that fixes it.
- **What agents must know goes in the repo** (`AGENTS.md`, `docs/learnings.md`, `.claude/` without personal paths), not in the local memory of each machine, which is not synced.
- **Warning**: if one of the machines is corporate, review its policy first (ownership of what is created on it and visibility for the company); at the very least, no secrets or business notes on that machine.
