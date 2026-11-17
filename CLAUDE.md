@AGENTS.md

## Claude Code only

- Global rules of this machine (its global `CLAUDE.md`, other projects' plugins) do not apply here; `.claude/settings.local.json` excludes them locally.
- Role subagents live in `.claude/agents/` and are thin adapters of `docs/agents/`. Use them as the orchestrator says; without subagents, run the roles in sequence.
- Conversation with the person in Spanish.
