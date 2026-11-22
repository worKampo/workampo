# Progress

PRD #10 · Ticket #96 entrar-con-codigo-o-google-y-salir · Branch: feature/96-entrar-con-codigo-o-google-y-salir
Step: Build › Implement
Done in this step: waves 1–12 (T1–T24); audit applied; T25 serving the SPA and fake consent page (acceptance 18/19); T26 smoke mode; T28 size budget
In progress: T25 — access-96-8 fails with the consent page (see Next)
Next: Decision: access-96-8 (protected) reads /api/me right after the Google click and races the callback behind the fake consent page; proposed reopen: wait for the URL / after each signInWithGoogle in that scenario. Then mark T25 done. The person applies the two workflow diffs (observation-check rename, E18 smoke) and does T27
Waiting for human: 🧑 T27 (WorkOS staging, secrets, deploy.yml step) before the staging smoke; WorkOS production billing before release
Open questions: none (WorkOS Magic Auth accepts `locale: ca`, checked in T14). ADR-0057 point 4 amended by the person (daab6aa); ADR-0047 gains `ca` and the fallback chain (dfece76); the ADR-0059 client reload belongs to ticket 95 (PRD 10, ticket 7).
Updated: 2026-11-22
