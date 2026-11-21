# Learnings

Short lessons that agents must not relearn. Why this file: [ADR-0052](adr/0052-living-specs-only-and-flow-by-size.md).

## Rules

- `AGENTS.md` makes agents read "General" and the section of each domain the ticket touches.
- Entry format, 1-3 lines: **when it applies** · **rule** · **why** · **link** (PR or issue).
- They enter when closing a ticket (proposed in the closing comment), when an error repeats, or after a postmortem. The agent adds the entry to the next PR it opens; the person sees it at moment 2. If none comes within a week, a small `docs:` PR.
- They leave when they become an automatic check (lint, test, CI) or a line of `AGENTS.md`.
- Limit about 100 lines: prune or convert. Pruned in the [monthly review](adr/0040-process-metrics-and-monthly-review.md).

## General

- Editing `.github/ISSUE_TEMPLATE` · it is excluded from Biome · Biome's Markdown formatter adds blank lines inside the front matter of issue templates, which breaks them · [PR #1](https://github.com/worKampo/workampo/pull/1), issue #6.
- Writing "D1" · it means the Cloudflare database unless it clearly cites ADR-0001; never auto-link it · avoids false links to the decision · [PR #26](https://github.com/worKampo/workampo/pull/26).
- Fixing review comments · group them into one push per round · a push after the person's approval dismisses it (the ruleset requires approval of the last push) · [ADR-0013](adr/0013-ci-cd-with-github-actions.md), [PR #3](https://github.com/worKampo/workampo/pull/3).
- Reading CodeRabbit's comments on a PR · read the review bodies too, not only the inline threads · CodeRabbit puts Minor and Nitpick findings inside the review body, so a review with no open thread can still carry findings · [PR #33](https://github.com/worKampo/workampo/pull/33).
- Writing a PR body, a test plan or a commit · never a closing keyword (`closes`, `fixes`, `resolves` and their forms) before `#n`, not even "the stg run closes #54"; write "ticket 54" · GitHub closes the issue at the merge, the staging job then skips it and its card stays in Review; `check:pr` rejects it in commits and PR bodies once [PR #61](https://github.com/worKampo/workampo/pull/61) is in, and never in the PR title, so check the title by hand · [PR #51](https://github.com/worKampo/workampo/pull/51), [PR #56](https://github.com/worKampo/workampo/pull/56).
- Bringing a PR branch up to date with `master` · merge `master` locally and push as the App; never GitHub's "Update branch" · that merge commit is authored by the bot or whoever clicks, the Author check rejects it, and with no force push the PR has to be rebuilt · [PR #58](https://github.com/worKampo/workampo/pull/58) → [PR #62](https://github.com/worKampo/workampo/pull/62).
- Writing a test that runs `git` in a temporary repo · drop every `GIT_*` variable from its environment · in a linked worktree the pre-commit hook exports `GIT_DIR` and `GIT_INDEX_FILE`, and the test wrote its commits into the real repository · [PR #41](https://github.com/worKampo/workampo/pull/41).
- Working in another worktree · create it where it will stay; after `git worktree move`, run `pnpm install --force` · pnpm links point at the old path, and the pre-commit `pnpm check` cannot even start · [PR #41](https://github.com/worKampo/workampo/pull/41).
- Querying Sentry issues by `environment` · a 404 can mean the environment has never received an event, not a wrong org; retry without it before calling it an error · prod had sent no event and every observation window failed · [PR #38](https://github.com/worKampo/workampo/pull/38).
- Changing a step of a workflow · before the merge: a workflow whose `workflow_dispatch` is already on `master` runs from the branch with `gh workflow run <file> --ref <branch>` (a trigger added only on the branch cannot be started this way) (the observation window has a `dry_run` input); a `pull_request` workflow already runs on the PR; `deploy.yml` (push to `master`) cannot run before the merge, so give a new step a condition, and use `continue-on-error` only for a non-critical step (a comment, the board token); a mandatory step must keep failing the job · the board token was proved this way, and a wrong key showed up before reaching `master` · [PR #51](https://github.com/worKampo/workampo/pull/51).
- Piping a file into `gh` on the person's Windows · the PowerShell `gh` function does not pass the pipe, and `cmd /c` runs the global `gh` (another account); use `cmd /c "set GH_CONFIG_DIR=%USERPROFILE%\.config\gh-workampo&& gh … < file"` · a secret ended up with the wrong value, then a 403 · [PR #51](https://github.com/worKampo/workampo/pull/51).
- Adding a CI check · put it in `pnpm check:ci`, not in a workflow file · the agents' App cannot push commits that change `.github/workflows/` · [PR #28](https://github.com/worKampo/workampo/pull/28).
- Checking that a path exists · a git-ignored file exists locally but not in CI, so the check treats it as missing · do not require ignored files · [PR #28](https://github.com/worKampo/workampo/pull/28).

## access

—

## companies

—

## billing

—

## public-site

—
