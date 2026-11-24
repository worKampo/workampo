# Progress

PRD #10 · Ticket #90 crear-la-primera-empresa · Branch: feature/90-crear-la-primera-empresa
Step: Build › Implement (wave 3)
Done in this step: T1; wave 2 T2–T7 (5f19528, 242d292, 2bf05a1, ca979aa, faf3894, 5012e0a)
In progress: —
Next: wave 3 (T8 tenancy seam, T9 /api/me name, T10 seeds). Names the tests pin: app-core createCompany(client, input, key), checkSlug(client, slug), getCompanyContext(client, slug), useCompanyContext(slug), useNewCompanyPage({ onCreated }) → { form, submit, slugStatus, askUserName }
Waiting for human: T11, RATE_LIMIT_COMPANY_CREATES_PER_USER and RATE_LIMIT_COMPANY_CREATES_PER_IP as Cloudflare secrets in stg and prod before the merge (env.ts requires them; without them every route behind parsedEnv fails)
Open questions: —
Updated: 2026-11-24
