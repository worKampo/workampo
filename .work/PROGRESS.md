# Progress

PRD #10 · Ticket #96 entrar-con-codigo-o-google-y-salir · Branch: feature/96-entrar-con-codigo-o-google-y-salir
Step: Build › Implement
Done in this step: waves 1–9 (T1–T19): the code sign-in, me and sign-out routes pass the wave-1 integration tests; the Google ones stay it.fails until T22
In progress: —
Next: Build › Implement wave 10: T20 (packages/client), T22 (Google routes), T23 (cron for expired counters)
Waiting for human: 🧑 T27 (WorkOS staging, secrets, deploy.yml step) before the staging smoke; WorkOS production billing before release
Open questions: none (WorkOS Magic Auth accepts `locale: ca`, checked in T14). ADR-0057 point 4 amended by the person (daab6aa); ADR-0047 gains `ca` and the fallback chain (dfece76); the ADR-0059 client reload belongs to ticket 95 (PRD 10, ticket 7).
Updated: 2026-11-22
