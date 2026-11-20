| ID  | Task                                                                              | Depends on | Touches                                                                | Size | Level    | Status |
| --- | --------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------- | ---- | -------- | ------ |
| T1  | moveCard uses BOARD_TOKEN for the board calls when the job has one                | —          | scripts/work/work.mjs, scripts/work/work.test.mjs                      | S    | max      | todo   |
| T2  | close-unobserved.mjs and observation/check.mjs pass their environment to moveCard | T1         | scripts/deploy/close-unobserved.mjs, scripts/observation/check.mjs     | S    | standard | todo   |
| T3  | ADR-0069, note in ADR-0064, project.yaml secret, deploy runbook                   | —          | docs/adr/, project.yaml, docs/runbooks/deploy.md                       | S    | max      | todo   |
| T4  | deploy.yml and observation-window.yml mint BOARD_TOKEN (the person pushes them)   | T1, T2     | .github/workflows/deploy.yml, .github/workflows/observation-window.yml | S    | max      | todo   |

Waves: 1 → T1 [P] T3 · 2 → T2 · 3 → T4
