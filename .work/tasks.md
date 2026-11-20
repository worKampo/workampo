| ID  | Task                                                                          | Depends on | Touches                                                                                                   | Size | Level    | Status |
| --- | ----------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------- | ---- | -------- | ------ |
| T1  | deploy.mjs: output observe=none for a current run with no Worker              | —          | scripts/deploy/deploy.mjs, scripts/deploy/deploy.test.mjs                                                 | S    | standard | done   |
| T2  | close-unobserved.mjs: close the tickets of a merge with no Worker             | T1         | scripts/deploy/close-unobserved.mjs, scripts/deploy/close-unobserved.test.mjs                             | M    | max      | done   |
| T3  | Docs: dated notes in ADR-0020 and ADR-0060, deploy runbook                    | —          | docs/adr/0020-ticket-lifecycle.md, docs/adr/0060-deploy-affected-workers-only.md, docs/runbooks/deploy.md | S    | standard | done   |
| T4  | deploy.yml: step that runs close-unobserved (the person pushes it)            | T1, T2     | .github/workflows/deploy.yml                                                                              | S    | max      | done   |
| T5  | Verify F1, F4: close-unobserved trusts only bot or trusted markers, skips PRs | T2         | scripts/deploy/close-unobserved.mjs, scripts/deploy/close-unobserved.test.mjs                             | S    | standard | done   |
| T6  | Verify F3: deploy.mjs accepts only a full SHA from /health                    | T1         | scripts/deploy/deploy.mjs, scripts/deploy/deploy.test.mjs                                                 | S    | standard | done   |
| T7  | Verify F2: parseRefs does not match Refs: across lines                        | —          | scripts/smoke/verification-comment.mjs, scripts/smoke/smoke.test.mjs                                      | S    | standard | done   |

Waves: 1 → T1 [P] T3 · 2 → T2 · 3 → T4 · 4 → T5 [P] T6 [P] T7
