---
status: accepted
date: 2026-11-13
---

# ADR-0015: Agent context, multi-tool

## Context

Agents need one source of context that works across tools. Lesson from the previous project: its `CLAUDE.md` files described folders that did not exist and schemas that had already changed.

## Decision

- `AGENTS.md` is the single source (architecture, commands, conventions, links to ADRs). It is written in English ([ADR-0036](0036-language-and-glossary.md)). Its first instruction: if `PROGRESS.md` exists on the branch, or a "Progress" comment on its open PR, start there ([ADR-0016](0016-procedure-harness.md)).
- `CLAUDE.md` only imports `@AGENTS.md` and adds what is exclusive to Claude.
- Minimal adapters for other tools (`.github/copilot-instructions.md`, `.cursor/rules`, `GEMINI.md`) that point to `AGENTS.md` without copying content.
- A per-package `AGENTS.md` only when the package has its own rules.
- **Agent context describes only what exists** (2026-11-13): no copied code fragments (link to the real file) and no future plans; CI checks that the paths named in `AGENTS.md` and its adapters exist.
- `README.md` is for people.
- **`REVIEW.md`** at the root: the PR **review policy** (a convention of Anthropic's AI-native SDLC playbook). It defines the passes (bugs, security with the checklist of [ADR-0032](0032-security-reviewer.md), compliance against the intent of the issue, the living-spec diff and `plan.md` if it exists, UI/UX against [ADR-0031](0031-ui-ux-designer.md)), what counts as *Important* and what as *Nit*, and what to ignore. The spec reviewer, the security reviewer and the AI review in CI apply it; their findings neither approve nor block on their own: the person approves. Exception: a finding from the "No entra" list ([ADR-0043](0043-public-repo.md)) is a failure that must be resolved. In English.
- **Pieces of each ticket** ([ADR-0052](0052-living-specs-only-and-flow-by-size.md)), with names aligned to the playbook: intent (issue body), change spec (living-spec diff), `plan.md` (L only) and our own `tasks.md`, temporary on the branch; verification is the "Verification" comment that CI generates (a different name from `REVIEW.md`). The PRD level ([ADR-0034](0034-prds-slicing-and-ticket-format.md)) is ours: the playbook does not have it.

## Consequences

See Decision.
