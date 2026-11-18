# .work/tasks.md template

Temporary file on the ticket branch. `pnpm work pr` deletes it when opening the PR; the checklist in the issue becomes the source ([ADR-0052](../../adr/0052-living-specs-only-and-flow-by-size.md)). Format: [ADR-0020](../../adr/0020-ticket-lifecycle.md).

```markdown
| ID | Task                        | Depends on | Touches                       | Size | Level    | Status |
|----|-----------------------------|------------|-------------------------------|------|----------|--------|
| T1 | Failing tests: <capability> | —          | <paths of the test files>     | S    | max      | todo   |
| T2 | <task>                      | T1         | <files or folders it writes>  | M    | standard | todo   |

Waves: 1 → T1 · 2 → T2
```

Rules:
- Status: `todo` / `doing` / `done`, updated by the orchestrator when starting and when committing each task.
- Size: S / M / L. Level: model effort per [ADR-0022](../../adr/0022-model-and-effort-by-complexity.md).
- Mark parallel tasks `[P]` in the Waves line (`2 → T3 [P] T4`) only if they do not depend on each other and do not touch the same files.
- Hot spots always in sequence: migrations, `package.json` and lockfile, central route registry, shared configuration.
- The first wave holds the failing tests (`it.fails`).
- `pnpm plan:sync` writes it as a checklist in the issue; nobody edits the checklist by hand.
