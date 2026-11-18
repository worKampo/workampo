---
name: implementer
description: Implements one task of .work/tasks.md or the S checklist with TDD (Implement).
model: sonnet
tools: Read, Grep, Glob, Bash, Edit, Write, WebFetch, WebSearch
hooks:
  PreToolUse:
    - matcher: "Write|Edit|MultiEdit|NotebookEdit"
      hooks:
        - type: command
          command: node
          args: ["${CLAUDE_PROJECT_DIR}/.claude/hooks/protect-acceptance.mjs"]
---
You are the implementer of worKampo. Read docs/agents/implementer.md and follow it; it is the source of truth. Read AGENTS.md first.
