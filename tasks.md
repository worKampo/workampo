# Tasks · Ticket #9 · Automatización del proceso

PRD #4 · Ticket #9 · Size L · Branch: feature/9-process-automation (one branch per PR: -a, -b, -c, -d)

| ID  | Task                                                                                                                                           | Depends on     | Touches                                                                                 | Size | Level    | Status |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------- | ---- | -------- | ------ |
| T1  | `pnpm work` core: args (`15` or `#15`), identity check, help, `status`, `resume`, `inbox`                                                      | —              | scripts/work/, package.json                                                             | M    | max      | todo   |
| T2  | `pnpm work start`, `pr`, `close`                                                                                                               | T1             | scripts/work/                                                                           | M    | max      | todo   |
| T3  | `plan:check`, `plan:sync`, `specs:ids`, `test:new`, `debt`                                                                                     | —              | scripts/plan/, scripts/specs/, scripts/test-new/, scripts/debt/, package.json           | M    | standard | todo   |
| T4  | Guides `work.md`, `planning.md`, `living-specs.md`, `testing.md`, `critical-paths.md`; AGENTS.md links; ADR notes for the two decisions of #27 | T1–T3          | docs/procedures/, AGENTS.md, docs/adr/0020-_, docs/adr/0030-_                           | S    | standard | todo   |
| T5  | Traceability checks (`scripts/checks/`, `pnpm check:pr`, commitlint, jscpd) with tests                                                         | T3             | scripts/checks/, commitlint.config.mjs, .jscpd.json, package.json                       | L    | max      | todo   |
| T6  | Workflow `traceability.yml` calling `pnpm check:pr` (person pushes)                                                                            | T5             | .github/workflows/traceability.yml                                                      | S    | max      | todo   |
| T7  | `db:seed`, `db:backfill`, `backfill.yml`, `reset-stg.yml`, guides (person pushes)                                                              | —              | packages/db/, scripts/db/, .github/workflows/, docs/procedures/                         | M    | max      | todo   |
| T8  | Playwright, `e2e` task and CI job, `pnpm work verify` (person pushes)                                                                          | T1, T7         | apps/api/, playwright.config.ts, scripts/work/, .github/workflows/ci.yml, turbo.json    | M    | standard | todo   |
| T9  | Observation window script and hourly workflow (person pushes)                                                                                  | T2             | scripts/observation/, .github/workflows/observation-window.yml, docs/runbooks/deploy.md | M    | max      | todo   |
| T10 | 🧑 Sentry Internal Integration and UptimeRobot read-only key as repo secrets; push of the workflow PRs                                         | T6, T7, T8, T9 | —                                                                                       | S    | standard | todo   |

Waves: 1 → T1 [P] T3 · 2 → T2 [P] T5 [P] T7 · 3 → T4 [P] T6 [P] T8 [P] T9 · 4 → T10

PRs: A = T1–T4 · B = T5–T6 · C = T7 · D = T8–T9 (T10 alongside B–D)
