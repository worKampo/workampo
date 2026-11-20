| ID  | Task                                                               | Depends on | Touches                                                                                                   | Size | Level    | Status |
| --- | ------------------------------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------------------- | ---- | -------- | ------ |
| T1  | deploy.mjs: output observe=none for a current run with no Worker   | —          | scripts/deploy/deploy.mjs, scripts/deploy/deploy.test.mjs                                                 | S    | standard | todo   |
| T2  | close-unobserved.mjs: close the tickets of a merge with no Worker  | T1         | scripts/deploy/close-unobserved.mjs, scripts/deploy/close-unobserved.test.mjs                             | M    | max      | todo   |
| T3  | Docs: dated notes in ADR-0020 and ADR-0060, deploy runbook         | —          | docs/adr/0020-ticket-lifecycle.md, docs/adr/0060-deploy-affected-workers-only.md, docs/runbooks/deploy.md | S    | standard | todo   |
| T4  | deploy.yml: step that runs close-unobserved (the person pushes it) | T1, T2     | .github/workflows/deploy.yml                                                                              | S    | max      | todo   |

Waves: 1 → T1 [P] T3 · 2 → T2 · 3 → T4
