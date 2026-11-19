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
