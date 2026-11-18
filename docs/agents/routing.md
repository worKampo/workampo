# Routing

Level per role and per task. Why: [ADR-0022](../adr/0022-model-and-effort-by-complexity.md). This is the only file that names models: to change a model, edit the table below and the `model:` line of the adapters in `.claude/agents/`.

## Levels

| Level | Model today | Claude Code `model` | Effort | Use |
|---|---|---|---|---|
| fast | Haiku 5.5 | `haiku` | low | Read-only searches, run `pnpm check` and summarize |
| standard | Sonnet 5.5 | `sonnet` | medium | Well-specified task, small plans, normal review |
| max | Opus 5.5 | `opus` | high | Design decisions, cross-cutting plans, debugging after the 2nd failure |

## Always max

Any task that touches auth/session, isolation between companies, migrations, billing or secrets runs at `max`, whatever the role default or the `Level` column says.

## Default level per role

| Role | Default | Raised to `max` when |
|---|---|---|
| orchestrator | max | — |
| slicer | max | — |
| security-reviewer | max | — |
| researcher | fast | Escalation only |
| ui-ux-designer | standard | New complete flow ([ADR-0031](../adr/0031-ui-ux-designer.md)) |
| planner | standard | `.work/plan.md` in L (cross-cutting plan) |
| test-designer | standard | Critical zone ([ADR-0030](../adr/0030-test-designer.md)) |
| implementer | standard | `Level` column says `max` |
| writer | standard | Escalation only |
| spec-reviewer | standard | Escalation only |
| verifier | standard | Escalation only |

## Per task

- The `Level` column of `.work/tasks.md` overrides the role default for that task (except "Always max"). S tickets have no `.work/tasks.md`: role default plus "Always max".
- The adapter's `model:` is the default. For another level, pass that model when launching the subagent. If the tool cannot set effort per subagent, the model alone carries the level.

## Escalation

1. A `failed` or `blocked` result: retry the same brief one level up (fast → standard → max).
2. Still `failed` or `blocked` at `max`: go to the person with stop 5 ([cycle](../process/cycle.md#mandatory-stops)): where it is stuck and what was tried.
3. A `blocked` whose cause is a mandatory stop 1–4 goes to the person at once; a stronger model does not resolve it.

The level is only for routing: it is not recorded in the issue checklist nor measured.
