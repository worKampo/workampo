# Progress

PRD #10 · Ticket #96 entrar-con-codigo-o-google-y-salir · Branch: feature/96-entrar-con-codigo-o-google-y-salir
Step: Build › Implement
Done in this step: waves 1–13 and T28 (T1–T26, T28): acceptance 19/19 locally after the access-96-8 reopen (aa0fd44)
In progress: —
Next: T27, the person's manual steps: WorkOS staging (Magic Auth, Google, redirect URI), app-stg secrets, the stg WORKOS_API_KEY secret and the deploy.yml E18 smoke diff; then the staging smoke
Waiting for human: 🧑 T27 (WorkOS staging, secrets, deploy.yml step) before the staging smoke; WorkOS production billing before release
Open questions: none (WorkOS Magic Auth accepts `locale: ca`, checked in T14). ADR-0057 point 4 amended by the person (daab6aa); ADR-0047 gains `ca` and the fallback chain (dfece76); the ADR-0059 client reload belongs to ticket 95 (PRD 10, ticket 7).
Updated: 2026-11-22
