# Progress

PRD #10 · Ticket #96 entrar-con-codigo-o-google-y-salir · Branch: feature/96-entrar-con-codigo-o-google-y-salir
Step: Build › Implement
Done in this step: waves 1–5 (T1–T9); wave 6 — T10 migrated D1 in Vitest and the d1 global database client, T11 identity seam (interface, fake, contract suite, registry, dependency-cruiser rules)
In progress: —
Next: Build › Implement wave 7: T12 (packages/ui), T13 (rate-limit store), T14 (WorkOS adapter; check locale ca), T15 (session store)
Waiting for human: 🧑 T27 (WorkOS staging, secrets, deploy.yml step) before the staging smoke; WorkOS production billing before release
Open questions: WorkOS Magic Auth `locale: ca` support to verify in T14 (else `es` by the fallback chain). ADR-0057 point 4 amended by the person (daab6aa); ADR-0047 gains `ca` and the fallback chain (dfece76); the ADR-0059 client reload belongs to ticket 95 (PRD 10, ticket 7).
Updated: 2026-11-22
