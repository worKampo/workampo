# Progress

PRD #10 · Ticket #90 crear-la-primera-empresa · Branch: feature/90-crear-la-primera-empresa
Step: Build › Verify
Done in this step: T1; wave 2 T2–T7; wave 3 T8–T10 (8342199, 2f4133a, ef050fa). Slug rules moved to packages/domain/src/_shared/slug.ts (D53); NEW_COMPANY_SHARD_ID moved to T15 (knip); wave 4 T12; wave 5 T13–T14 (151a73c, 65a6458); API URL rules with their check (fe98821, the person 2026-11-25; spike #164 for the rest); wave 6 T15–T16 (21d4249, c6136cf), plus 76778f5 (rethrowUniqueViolation) and 53c4387 (no retry on 4xx). API e2e 33/33 green; waves 7–8 T17–T18 (6c2f099, 6aab407). All code tasks done; web e2e 25/25, API e2e 33/33
In progress: —
Next: Verify (spec reviewer, verifier, UI/UX designer, security reviewer), then Document, then pnpm work pr. T11 (thresholds as secrets in stg and prod) is the person's, before the merge. Spike #164 research is in its comment; it applies after this ticket merges.
Waiting for human: T11, RATE_LIMIT_COMPANY_CREATES_PER_USER and RATE_LIMIT_COMPANY_CREATES_PER_IP as Cloudflare secrets in stg and prod before the merge (env.ts requires them; without them every route behind parsedEnv fails)
Open questions: —
Updated: 2026-11-24
