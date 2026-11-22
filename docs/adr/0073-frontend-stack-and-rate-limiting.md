---
status: accepted
date: 2026-11-22
related: [6, 12, 19, 29, 47, 53, 57, 59, 65, 66, 71]
---

# ADR-0073: Frontend stack of the SPA and rate limiting on D1

## Context

PRD 10 sets up the first SPA (`apps/web`). [ADR-0053](0053-code-conventions.md) left router, server state and forms for that moment, and [ADR-0047](0047-i18n-from-the-start.md) left the i18n library open. The constraints are already decided: Vite and shadcn/ui on the web, Expo later ([ADR-0057](0057-ready-for-a-mobile-app.md)); Tailwind v4 and tokens in `packages/ui` ([ADR-0066](0066-design-system.md)); Zod at the boundaries and base frameworks used directly ([ADR-0053](0053-code-conventions.md)); Hono `hc` client ([ADR-0019](0019-typed-contract-with-hono-rpc.md)); the `app` Worker serves API and SPA from Static Assets on one origin ([ADR-0012](0012-workers-static-assets-no-pages.md), [ADR-0006](0006-same-origin-route-map.md)); version headers and cache rules ([ADR-0059](0059-web-client-version.md)); zero spend ([ADR-0065](0065-zero-spend-and-free-tier-limits.md)).

Sign-in by email code also needs limits on code requests and failed attempts. [ADR-0065](0065-zero-spend-and-free-tier-limits.md) deferred rate limiting because the Workers binding was not confirmed on the Free plan. The Cloudflare docs (consulted 2026-11-22) still say nothing about its plan or price, and it only counts in 10 or 60 s windows, per location and approximately.

## Decision

Decided by the person in ticket 96 (2026-11-22).

1. **Frontend stack**, with the fewest dependencies that meet the ADRs above:

| Slot | Choice | Rejected |
|---|---|---|
| Build | Vite + React, `@vitejs/plugin-react`; Tailwind v4 through `@tailwindcss/vite` | Cloudflare Vite plugin: Wrangler already builds and serves the Worker |
| Router | TanStack Router with **code-based routes**: typed params and search params, routes declared inside each domain folder | React Router: typed routes only in framework mode; file-based routing: forces a `routes/` folder against the domain layout |
| Server state | TanStack Query over the `hc` client; its hooks never touch the DOM, so they move to a shared package when the mobile app arrives | Hand-made fetching: re-implements cache, races and invalidation |
| Forms | react-hook-form with the Zod resolver, on shadcn's `Field` | TanStack Form: more verbose; plain forms: no dirty state for the save bar |
| Validation | Zod, as [ADR-0053](0053-code-conventions.md) says; `@hono/zod-validator` on API input so `hc` keeps the types | Valibot |
| i18n | i18next + react-i18next: one JSON file per language in the repo, English keys `domain.screen.element`, typed keys through a TypeScript declaration, plurals and `Intl` formats. Our code applies the language order of [ADR-0047](0047-i18n-from-the-start.md); no detector plugin. A script in `pnpm check` fails if any language misses a key | Paraglide: a new major (3.0) three weeks old and a change of maintainer, plus a compiler in Vite and Vitest; Lingui: needs a macro compiler |

   - Classified as **base** dependencies ([ADR-0053](0053-code-conventions.md)): used directly, no adapter.
   - Versions are pinned like the rest of the repo and respect `minimumReleaseAge`.
2. **Serving**: no new Worker. `apps/web` builds to `apps/web/dist`, and the `app` Worker (`apps/api/wrangler.jsonc`) serves it as Static Assets with `not_found_handling: "single-page-application"` and `run_worker_first` limited to the Worker's routes (`/api/*`, `/health`, `/l/*`). Asset requests do not invoke the Worker and do not count against the daily request quota.
   - The SPA's headers (strict CSP, `immutable` on hashed files, `no-cache` on `index.html`, [ADR-0059](0059-web-client-version.md)) live in `apps/web/public/_headers`; the Worker sets the headers of its own responses.
   - The API build depends on the web build in Turborepo, so one deployment always carries both.
   - Local development: Vite's dev server proxies `/api` to `wrangler dev`; E2E and `pnpm work verify` use `wrangler dev` with the built SPA, the same shape as production.
3. **Rate limiting with counters in `DB_GLOBAL`**: one table of fixed-window counters, keyed by purpose and subject (code requests per email and per IP, failed attempts per email; the email stored as a hash), incremented atomically with a single upsert that returns the new count. Thresholds and windows are environment variables (AGENTS.md "No entra"). The Worker's single cron deletes expired windows ([ADR-0048](0048-separate-backoffice-worker-and-account-limits.md)). WorkOS's own limits stay as a second layer.
   - Why not the binding: availability on Free is not documented, its windows are 10 or 60 s, and its counts are per location and approximate. Not KV: 1,000 writes a day and eventual consistency. Not a Durable Object: strict and free, but one more moving part for the same result.
   - It can be revisited when the binding is confirmed on Free (for short per-IP bursts) or when the counters' writes weigh on D1 Free.

This resolves the "Decided later" line of [ADR-0053](0053-code-conventions.md) for router, server state and forms, the library of [ADR-0047](0047-i18n-from-the-start.md), and the deferred rate limiting of [ADR-0065](0065-zero-spend-and-free-tier-limits.md) for sign-in.

## Consequences

- Six new runtime packages in `apps/web` (React, TanStack Router, TanStack Query, react-hook-form with its resolver, i18next with react-i18next) plus Vite and Tailwind as build tools; nothing new in the Worker except `@hono/zod-validator`.
- Every rate-limited request costs one row write in D1 (index writes included), well under the 100,000 daily rows of D1 Free; the counters table is one more table in `DB_GLOBAL`.
- The SPA fallback answers every path not listed in `run_worker_first`; when the corporate website arrives at `/` ([ADR-0006](0006-same-origin-route-map.md)), the route list is reviewed.
- `apps/web` imports the API's route type for `hc`; dependency-cruiser allows that import as type-only.
- WorkOS is called with `fetch` (three calls), not its SDK, and receives the IP and user agent of each sign-in. Its production environment asks for billing details even under the free tier: adding a card is the person's explicit decision before going to production ([ADR-0065](0065-zero-spend-and-free-tier-limits.md)).
- Pending check: whether the `assets` block of `wrangler.jsonc` is inherited by `env.stg` and `env.prod` or must be repeated like the bindings.
