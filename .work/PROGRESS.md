# Progress

PRD #10 · Ticket #96 entrar-con-codigo-o-google-y-salir · Branch: feature/96-entrar-con-codigo-o-google-y-salir
Step: Build › Implement
Done in this step: waves 1–12 (T1–T24); audit of 2026-11-22 applied; T25 serving the SPA from the app Worker, acceptance 18/19 green
In progress: T25 — access-96-7 fails locally (see Next)
Next: Decision on access-96-7 (Playwright cannot route the callback reached by the fake's server redirect), then finish T25 and wave 14: T26, T28
Waiting for human: 🧑 T27 (WorkOS staging, secrets, deploy.yml step) before the staging smoke; WorkOS production billing before release
Open questions: none (WorkOS Magic Auth accepts `locale: ca`, checked in T14). ADR-0057 point 4 amended by the person (daab6aa); ADR-0047 gains `ca` and the fallback chain (dfece76); the ADR-0059 client reload belongs to ticket 95 (PRD 10, ticket 7).
Updated: 2026-11-22
