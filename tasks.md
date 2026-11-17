# Tasks · Ticket #7 · Despliegue a staging y producción con observabilidad mínima

PRD #4 · Ticket #7 · Size L · Branch: feature/7-deploy-and-observability

| ID  | Task                                                                                                                                                                      | Depends on | Touches                                                     | Size | Level    | Status |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------- | ---- | -------- | ------ |
| T1  | `wrangler.jsonc` environments (local, stg, prod), `nodejs_compat`, version metadata, D1 and KV bindings with migrations dirs                                              | —          | apps/api/wrangler.jsonc, apps/api/worker-configuration.d.ts | S    | max      | done   |
| T2  | Provisioning script: D1 and KV per environment with EU jurisdiction, idempotent, needs a token, prints the IDs                                                            | —          | scripts/cloudflare/                                         | S    | max      | done   |
| T3  | `/health` with SHA and version; `X-Client-Version` log; `X-App-Version` when defined; integration tests                                                                   | T1         | apps/api/src/                                               | S    | standard | done   |
| T4  | Sentry (`@sentry/hono`) with release, environment and PII off; stg-only debug error route; tests                                                                          | T3         | apps/api/src/, apps/api/package.json, pnpm-lock.yaml        | M    | max      | done   |
| T5  | Deploy script: environment guard, affected Workers from the deployed SHA, migrate every D1, Sentry source maps, tagged deploy; tests for the guard and the affected logic | T1         | scripts/deploy/, package.json, pnpm-lock.yaml               | M    | max      | done   |
| T6  | Smoke script and verification comment ("Staging verification", "Release verification")                                                                                    | —          | scripts/smoke/                                              | S    | standard | done   |
| T7  | Workflows `deploy.yml` and `deploy-all.yml` (person pushes them)                                                                                                          | T5, T6     | .github/workflows/                                          | S    | max      | done   |
| T8  | Docs: deploy and rollback runbooks, `docs/platform.md`, real data in `project.yaml`, ADR lines (0039, 0048, 0063)                                                         | T1–T7      | docs/runbooks/, docs/platform.md, project.yaml, docs/adr/   | S    | standard | done   |
| T9  | 🧑 Provision, tokens and secrets, Sentry EU org and project, UptimeRobot, approve first prod deploy, rehearse rollback, test error in Sentry                              | T7, T8     | —                                                           | M    | standard | todo   |

Waves: 1 → T1 [P] T2 [P] T6 · 2 → T3 [P] T5 · 3 → T4 · 4 → T7 [P] T8 · 5 → T9
