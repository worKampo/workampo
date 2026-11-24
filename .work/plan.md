PRD #10 · Ticket #90 · Branch: feature/90-crear-la-primera-empresa

Decisions of the person (2026-11-24) on the open questions are marked **(decided)**. Security controls come from the issue's Security section.

## Seams and sharing

- **No new provider adapter.** The database seam grows:
  - `apps/api/src/_shared/db/d1-shard-db.ts`: `shardDb(env, bindingName)`, the only reader of `DB_SHARD_*`. It accepts only `DB_SHARD_<n>` bindings present in `env`; `DB_GLOBAL` or an unknown name fails closed (500 to Sentry), never falls back to `shard-1`.
  - `apps/api/src/_shared/tenancy/shard.d1.repo.ts`: `shardClient(env, shardId)` reads the `shards` row (engine, binding_name), caches it per isolate and returns the client; an engine other than `d1` throws. `shortcut: rows cached per isolate, shards change only by migration and redeploy (ADR-0010); drop the cache when shards are added at runtime`.
  - `apps/api/src/_shared/tenancy/placement.ts`: `NEW_COMPANY_SHARD_ID = 'shard-1'` (`shortcut: one shard, until a second exists`).
- **Tenancy rules, no I/O**, with unit tests across mode × stg/prod suffix × base URL with and without trailing `/` × path with and without leading `/` (ADR-0005):
  - `_shared/tenancy/resolve-tenant.ts`: `resolveTenant(url, { mode, hostSuffix }) → slug | null`. Path mode `^/(api/t|c)/<slug>(/|$)`; subdomain mode the host minus `TENANT_HOST_SUFFIX`; anything failing `slugSchema` is null.
  - `_shared/tenancy/tenant-url.ts`: `tenantUrl(slug, path, { mode, publicBaseUrl, hostSuffix })`. Path mode `<PUBLIC_BASE_URL>/c/<slug><path>`; subdomain mode `<protocol>//<slug><suffix>/app<path>`.
- **`packages/domain/src/companies/`:**
  - `errors.ts`: `COMPANIES_ERROR_CODES`, added to the union in `src/errors.ts`.
  - `creation/slug.ts`: `slugSchema` (3–40, `^[a-z0-9]+(-[a-z0-9]+)*$`, not ending in `-stg`, not in `RESERVED_SLUGS`); `slugProblem(slug) → 'invalid' | 'reserved' | null`; `proposeSlug(name)` (NFD, strip diacritics, lowercase, non-`[a-z0-9]` → `-`, trim `-`, cut at 40, trim again). **(decided)** `RESERVED_SLUGS`: admin, api, app, assets, bo, c, docs, health, l, legal, login, mail, static, status, stg, www, workampo.
  - `creation/create-company.ts`: `makeCreateCompanySchema(languages)` → `.strict()` `{ name, slug, defaultLanguage, userName? }`; the client never sets status, shard, role or ids. A factory because `@workampo/i18n` has a dev dependency on domain; the API and app-core pass `LANGUAGES`. **(decided)** `name` and `userName`: trimmed, NFC, 1–80 characters, no control or bidi control characters (U+202A–U+202E, U+2066–U+2069).
  - Unit tests: E2, E4, E5, accents and ñ, the name rules.
- **`packages/i18n`:** namespace `companies` (`en`, `es`, `ca`, `_context`) wired into `index.ts` and `i18next.d.ts`: `new_company.*`, `company_home.welcome` («Bienvenido a {{name}}»), `not_found.*`, `errors.*` for every code; `access.home.create_company`.
- **`packages/app-core/src/companies/`:**
  - `data/companies.api.ts` (`createCompany` with the `Idempotency-Key` header, `checkSlug`, `getCompanyContext`), `data/query-keys.ts`;
  - `creation/create-company/create-company.hook.ts` + `.form.ts`; `creation/check-slug/check-slug.hook.ts`;
  - `creation/new-company/new-company.hook.ts` (`useNewCompanyPage`): proposes the slug from the name until the slug is edited, checks availability 300 ms after the local `slugProblem`, keeps one UUID key from mount until success, shows «Tu nombre» only when `me.name` is null, calls `onCreated(url)`;
  - `workspace/read-context/read-context.hook.ts` with its `queryOptions`, reused by i#92; new `exports` for what the web uses.
- **API `apps/api/src/companies/`:**
  - `companies.router.ts` (mounted under `/api`) → `creation/creation.router.ts` → `create-company/`, `check-slug/`; `workspace/workspace.router.ts` (mounted at `/t/:slug`) → `read-context/`;
  - `errors.ts`: `CompaniesError` with its statuses; `require-member.middleware.ts` at the top level, so other domains can use it;
  - `data/`: `company`, `member`, `company-contact`, `company-creation-request`, `unit`, `assignment`, `company-profile`, `company-creation` (atomic writes), all `.d1.repo.ts` (8 files, the folder limit).
  - **(decided)** `company-creation.d1.repo.ts` also writes `users.name` (`WHERE name IS NULL`) in the global `batch()`: a written exception to "a domain writes only its tables", commented at the write, so E8 is atomic.
- **Access:** `userRepo.findById` and `readMe` return `name`; `home.page.tsx` gets the «Crear empresa» link to `/companies/new`.
- **Web `apps/web/src/companies/`:** `companies.route.ts` in `route-tree.ts`; `creation/creation.route.ts` `/companies/new` with the session guard → `new-company/new-company.page.tsx` + `new-company-form.tsx`; `workspace/workspace.route.ts` `/c/$slug` with the session guard (E13) → `company-home/company-home.page.tsx` (welcome, or the not-found state on a 404). After creating: same origin → router navigation to the pathname, otherwise `location.assign(url)`. Company names render only as JSX text.
- **Docs:** first rules in `docs/domains/companies.md` with `@wip(#90)`; glossary `unit`, `assignment`, `main contact`; code-conventions "tenancy/ arrives with the company shard" in present tense; `docs/procedures/critical-paths.md` adds `apps/api/src/_shared/tenancy/**`, `apps/api/src/companies/require-member.middleware.ts` and `packages/domain/src/companies/**`.

## Data model

DB_GLOBAL (`schema/global.d1.ts`):

- `shards`: `id` text PK (`'shard-1'`), `engine` CHECK IN (`'d1'`), `binding_name`, `created_at`; `uq_shards__binding_name`. Never credentials.
- `companies`: `id` UUIDv7 PK, `slug`, `name`, `shard_id` → `shards.id`, `status` CHECK IN (`'active','trialing','deleting'`) (only `active` written), `created_at`, `updated_at`, `updated_by`; `uq_companies__slug`, `idx_companies__shard_id`. A `deleting` slug stays taken.
- `members`: `id` UUIDv7 PK, `tenant_id` → companies, `user_id` → users, `status` CHECK IN (`'active','suspended','leaving'`), timestamps, `updated_by`; no role (ADR-0072); `uq_members__tenant_id_user_id`, `idx_members__user_id`.
- `company_contacts`: `tenant_id`, `topic` CHECK IN (`'main'`), `user_id`, `created_at`; PK `(tenant_id, topic, user_id)`; `idx_company_contacts__user_id`. Ids only.
- `company_creation_requests`: `user_id`, `idempotency_key` (UUID), `body_hash` (SHA-256 of the normalized body), `tenant_id` → companies, `created_at`; PK `(user_id, idempotency_key)`; `idx_company_creation_requests__tenant_id`. Not `idempotency_keys`, a shard table name in ADR-0053.
- `users.name` text NULL: null means no name yet (E8, E9).

Shard (`schema/shard.d1.ts`, export `@workampo/db/schema/shard.d1`):

- `units`: `id` PK, `tenant_id`, `parent_id` NULL → units, `name` NULL (root has none), `kind`, `path`, `attributes` (JSON text, `'{}'`), `is_active`, timestamps, `updated_by`; `uq_units__tenant_id` partial `WHERE parent_id IS NULL`, `idx_units__tenant_id_path`, `idx_units__tenant_id_parent_id`. **The root's id is the company id**, `path` = `<tenant_id>/`, so the retry is idempotent.
- `assignments`: `id` UUIDv7 PK, `tenant_id`, `member_id` (global `members.id`, no FK), `role_key` CHECK IN (`'owner','admin','member','viewer'`), `unit_id` → units, `created_at`; `uq_assignments__tenant_id_member_id_role_key_unit_id`, `idx_assignments__tenant_id_unit_id`. By member, so a re-invited member inherits nothing.
- `company_profiles`: `tenant_id` PK, `default_language` CHECK IN (`'en','es','ca'`), timestamps, `updated_by` (ADR-0053 puts it in the shard).

## API contracts

All behind `requireSession` (401 `access.unauthenticated`, before any company lookup); problem+json; `csrf()` on `POST /api/*` as today.

- `POST /api/companies`
  - Request: header `Idempotency-Key` (UUID, required); JSON body `{ name, slug, defaultLanguage, userName? }`; `application/json` only.
  - Responses: `201 { id, slug, name, url }` (`url` = `tenantUrl(slug, '/')`), the same on a replay; `400 companies.invalid_request` (key missing or malformed, body invalid or with extra fields); `400 companies.invalid_slug`, `400 companies.reserved_slug`; `400 companies.user_name_required`; `409 companies.slug_taken`; `422 companies.idempotency_mismatch` (same key, other body); `429` over the limit.
  - **(decided)** Rate limit: `hitRateLimit` purpose `company_create`, subjects `user` (new kind) and `ip`; thresholds are env vars validated in `env.ts`, test values in local `vars`, Cloudflare secrets in stg and prod. A replay that returns an existing company does not count.
  - Logic:
    1. Look up `(userId, key)`. Found with another `body_hash` → 422; found with the same → step 4 with that tenant.
    2. Otherwise one global `batch()`: company (`active`, `shard_id = NEW_COMPANY_SHARD_ID`), member (`active`), `main` contact, creation request with `body_hash`, and `users.name` only with `userName`.
    3. `UniqueViolationError` → re-read `(userId, key)`: found → step 4; not found → 409 (E10).
    4. One shard `batch()` through `shardClient`, every insert `ON CONFLICT DO NOTHING`: root unit, `owner` assignment, `company_profiles`. A throw → 500 and Sentry; the client keeps the key and a retry completes it once (E11).
- `GET /api/company-slugs/:slug` → `200 { available }` after `slugSchema`, else `400 companies.invalid_slug | reserved_slug`. Never the name, status or owner of a company. **(decided)** No rate limit: a read behind a session, slugs are public, a limit would write to D1 per keystroke (ADR-0073); the client debounces.
- `requireMember` on `/api/t/:slug/*`: the slug only from `resolveTenant(c.req.url)`, never a header, body or query; one global query `companies` JOIN `members` (slug, session user, member `active`, company `active|trialing`); no row → `404 companies.not_found`, the same status, body and headers for an invalid slug, a missing, inactive or foreign company and a suspended or leaving member (E12); sets `c.var.company = { tenantId, slug, name, shardId, memberId }`.
- `GET /api/t/:slug/` (read-context, for i#92) → `200 { name, slug, role }`, the strongest of the member's assignments on the root (`shortcut: until can() in PRD #71`); no assignment → 404, never `owner` (ADR-0072 point 9).
- `GET /api/me` adds `name: string | null`.
- Config in `env.ts` `common` and every env of `wrangler.jsonc`: `TENANT_ROUTING` `path|subdomain` (`path` everywhere); `PUBLIC_BASE_URL`; `TENANT_HOST_SUFFIX`, required by a refine in `subdomain` mode; the company-create thresholds. Both Playwright configs pass `--var PUBLIC_BASE_URL:https://localhost:<port>`. Subdomain mounting waits for a domain (ADR-0014).
- Logs and Sentry never carry request bodies (names).

## Migrations

Header `-- ticket: #90`; expand only, applied before the code, nothing irreversible.

- `global.d1`: `0004_create_shards`; `0005_insert_shard_1` (data migration, `ON CONFLICT DO NOTHING`, same binding name in every env; **(decided)** reference data is a migration, not a seed, ADR-0044); `0006_create_companies`; `0007_create_members`; `0008_create_company_contacts`; `0009_create_company_creation_requests`; `0010_add_users_name`.
- `shard.d1`: `0000_create_units`; `0001_create_assignments`; `0002_create_company_profiles`.
- `packages/db/package.json` exports `./schema/shard.d1`; `vitest.config.ts` and `test/setup.ts` apply the shard migrations to `DB_SHARD_1`.
- Seeds (portable SQL, fixed ids and dates, `ON CONFLICT DO NOTHING`): `seed/global/0001-access.sql` names some users and leaves one without (E8, E9); `seed/global/0002-companies.sql` with `northwind`, `sol-bakery` and a long unicode name on `shard-1`, one user in two companies and one only in `sol-bakery`, main contacts; `seed/shard/0001-companies.sql` with roots, `owner` assignments and profiles.

## Flags

None: the only way into the product, shipped visible.

## Analytics events

`company_created { tenant_id }` once the global batch lands, never on a replay. Not emitted yet: no analytics adapter (ADR-0038); listed for that ticket.

## Risks

- **Global lands, shard does not:** the member gets 404 at `/c/<slug>` until a retry with the same key; int test seeds only the global part and POSTs twice. **(decided)** Losing the key on reload leaves the slug taken: repair in its own MVP issue.
- **Isolation (E12):** one query for membership and existence; the suite is born in `apps/api/e2e/acceptance/isolation.e2e.ts` and walks every route registered under `/api/t/:slug` (not a hand list), asserting a foreign session gets 404; a route without the middleware fails it. Byte-identical 404s across the cases; same 401 without a session.
- **E12 on the page (decided):** the SPA answers `/c/<slug>` with HTTP 200 and the not-found state; the API 404 is the boundary.
- **Concurrent slug (E10):** the unique index decides; int test with two parallel POSTs leaves one company, one member, one contact.
- **CHECK enums** (`role_key`, `engine`, `status`, `topic`): widening one means a table rebuild migration.
- **Cross-domain write** of `users.name` from companies (decided, commented).
- **Owner grant not audited (decided):** deferred to PRD #71/#11, when `audit_events` arrives.
- **No limit of companies per account:** Post-MVP per the issue; the create rate limit covers bursts.
- **`PUBLIC_BASE_URL` mismatch** in e2e or verify: the `--var` override and same-origin navigation.
