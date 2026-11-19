# Progress

Ticket #43 pnpm-work-usa-su-propio-gh-de-la-cuenta · Branch: feature/43-pnpm-work-usa-su-propio-gh-de-la-cuenta
Step: Deliver › Pull request
Done in this step: without `GH_TOKEN`, `pnpm work` sets `GH_CONFIG_DIR` (the one already set, or `~/.workampo/gh`) before any `gh` call; the identity error gives the login command for that config (Git Bash and PowerShell) and no longer suggests `gh auth switch`; tests; `docs/process/bootstrap.md` and `docs/procedures/work.md` updated; `pnpm check` green
In progress: —
Next: the person logs in once in `~/.workampo/gh` (bootstrap), checks with `pnpm work status` from PowerShell and Git Bash (moment 2), approves and merges
Waiting for human: moment 2 (one-time login, local check, approve and merge the PR)
Open questions: —
Updated: 2026-11-19 10:30
