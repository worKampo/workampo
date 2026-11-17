---
status: accepted
date: 2026-11-10
---

# ADR-0022: Model and effort by complexity

## Context

Different tasks need different models and effort levels. The level is chosen per role and per task so that cheap work does not use the strongest model.

## Decision

| Level | Model today | Effort | Use |
|---|---|---|---|
| fast | Haiku 5.5 | low | read-only searches, run `check` and summarize |
| standard | Sonnet 5.5 | medium | well-specified task, small plans, normal review |
| max | Opus 5.5 | high | design decisions, cross-cutting plans, debugging after the 2nd failure |

- The orchestrator, the slicer and the security reviewer work at `max`.
- Default level per role (frontmatter) and adjustment per task according to the `Level` column of `tasks.md`.
- **Always `max`**: auth/session, isolation between companies, migrations, billing, secrets.
- Automatic escalation: a `failed` / `blocked` result retries one level up; it escalates to the person after `max` is exhausted.
- The level is only used for routing: it is not recorded in the checklist or measured. Table and rules in `docs/agents/routing.md` (a single place to change models).

## Consequences

See Decision.
