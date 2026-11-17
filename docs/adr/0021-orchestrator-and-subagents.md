---
status: accepted
date: 2026-11-10
---

# ADR-0021: Orchestrator and subagents

## Context

Ticket work is split between one orchestrator that talks to the person and subagents with narrow roles (the "star" topology). The rules below set who talks to whom, what each subagent receives and returns, and where the roles are defined.

## Decision

- Only the orchestrator talks to the person; it owns the three moments, the mandatory stops ([ADR-0020](0020-ticket-lifecycle.md)), the artifacts and the loops.
- Each subagent receives a self-contained assignment (goal, files and ADRs, definition of done, what not to touch) and returns: status (`done` / `blocked` / `failed`), summary, evidence, files touched, open questions.
- Subagents do not talk to the person or to each other, and do not launch other subagents.
- Parallel reading is free; parallel writing only according to the waves of `tasks.md` ([ADR-0020](0020-ticket-lifecycle.md)).
- Reviewers receive spec + diff, not the implementer's reasoning.
- **Roles**: slicer ([ADR-0034](0034-prds-slicing-and-ticket-format.md)), researcher, UI/UX designer ([ADR-0031](0031-ui-ux-designer.md)), planner, test designer ([ADR-0030](0030-test-designer.md)), implementer, writer (Document step), spec reviewer, security reviewer ([ADR-0032](0032-security-reviewer.md)), verifier. Defined in `docs/agents/<role>.md` (English) with adapters per tool (`.claude/agents/`). Without subagent support, the orchestrator runs the roles in sequence.
- **The orchestrator** is not a subagent: its rules (moments, stops, loops, `PROGRESS.md`, assignments) live in `docs/agents/orchestrator.md`, linked from `AGENTS.md`.
- Agent permission limits: [ADR-0041](0041-agent-boundaries.md).

## Consequences

See Decision.
