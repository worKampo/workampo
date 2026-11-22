# Progress

PRD #10 · Ticket #96 entrar-con-codigo-o-google-y-salir · Branch: feature/96-entrar-con-codigo-o-google-y-salir
Step: Build › Implement
Done in this step: waves 1–6 (T1–T11); wave 7 — T13 rate-limit store, T14 WorkOS adapter (Magic Auth accepts ca), T15 session store; domain regrouped by feature and the rate-limit window moved to the API (8fae343)
In progress: —
Next: Build › Implement wave 7: T12 (packages/ui); then wave 8: T16 (web scaffold), T17 (completeSignIn), T18 (seed)
Waiting for human: 🧑 T27 (WorkOS staging, secrets, deploy.yml step) before the staging smoke; WorkOS production billing before release
Open questions: none (WorkOS Magic Auth accepts `locale: ca`, checked in T14). ADR-0057 point 4 amended by the person (daab6aa); ADR-0047 gains `ca` and the fallback chain (dfece76); the ADR-0059 client reload belongs to ticket 95 (PRD 10, ticket 7).
Updated: 2026-11-22
