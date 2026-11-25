# Progress

PRD #10 · Ticket #90 crear-la-primera-empresa · Branch: feature/90-crear-la-primera-empresa
Step: Build › Implement (wave 5)
Done in this step: T1; wave 2 T2–T7; wave 3 T8–T10 (8342199, 2f4133a, ef050fa). Slug rules moved to packages/domain/src/_shared/slug.ts (D53); NEW_COMPANY_SHARD_ID moved to T15 (knip); wave 4 T12
In progress: —
Next: wave 5 (T13 check-slug, T14 app-core workspace). Names the tests pin: app-core createCompany(client, input, key), checkSlug(client, slug), getCompanyContext(client, slug), useCompanyContext(slug), useNewCompanyPage({ onCreated }) → { form, submit, slugStatus, askUserName }
Waiting for human: T11, RATE_LIMIT_COMPANY_CREATES_PER_USER and RATE_LIMIT_COMPANY_CREATES_PER_IP as Cloudflare secrets in stg and prod before the merge (env.ts requires them; without them every route behind parsedEnv fails)
Open questions: —
Updated: 2026-11-24
