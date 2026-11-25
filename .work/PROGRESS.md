# Progress

PRD #10 · Ticket #90 crear-la-primera-empresa · Branch: feature/90-crear-la-primera-empresa-v2
Step: Build › Document
Done in this step: T1; wave 2 T2–T7; wave 3 T8–T10 (8342199, 2f4133a, ef050fa). Slug rules moved to packages/domain/src/_shared/slug.ts (D53); NEW_COMPANY_SHARD_ID moved to T15 (knip); wave 4 T12; wave 5 T13–T14 (151a73c, 65a6458); API URL rules with their check (fe98821, the person 2026-11-25; spike #164 for the rest); wave 6 T15–T16 (21d4249, c6136cf), plus 76778f5 (rethrowUniqueViolation) and 53c4387 (no retry on 4xx). API e2e 33/33 green; waves 7–8 T17–T18 (6c2f099, 6aab407). All code tasks done; web e2e 25/25, API e2e 33/33; Verify: spec, verifier, security and UI/UX reviews; findings T19–T22 (d9e95be, 9f806cf, a46f140, 2c23b2f); follow-ups #165–#169; the person tested on localhost (create works; re-entry is #91); T11: the person set both company-create thresholds as secrets in stg and prod (2026-11-25, names checked with wrangler secret list)
In progress: —
Next: rebuilt as this -v2 branch (65a6458 split, the scenario commit carries Reopen: 7158662374; Acceptance order passes); then Document and pnpm work pr.
Waiting for human: —
Open questions: —
Updated: 2026-11-24
