# Progress

PRD #10 · Ticket #96 entrar-con-codigo-o-google-y-salir · Branch: feature/96-entrar-con-codigo-o-google-y-salir
Step: Build › Implement
Done in this step: waves 1–12 (T1–T24 except T27): code and Google sign-in, sessions, cron, the shared app-core, the web screens as lazy routes, the fake kept out of stg and prod
In progress: —
Next: Build › Implement wave 13: T25 (serve the SPA from the app Worker, Playwright on localhost; the acceptance scenarios run here)
Waiting for human: 🧑 T27 (WorkOS staging, secrets, deploy.yml step) before the staging smoke; WorkOS production billing before release
Open questions: none (WorkOS Magic Auth accepts `locale: ca`, checked in T14). ADR-0057 point 4 amended by the person (daab6aa); ADR-0047 gains `ca` and the fallback chain (dfece76); the ADR-0059 client reload belongs to ticket 95 (PRD 10, ticket 7).
Updated: 2026-11-22
