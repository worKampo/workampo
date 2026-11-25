# Code conventions

Rules an implementer applies. Why: [ADR-0053](../adr/0053-code-conventions.md) (also [ADR-0054](../adr/0054-roles-and-permissions.md), [ADR-0057](../adr/0057-ready-for-a-mobile-app.md)). Enforced by `pnpm check`: [`.dependency-cruiser.cjs`](../../.dependency-cruiser.cjs) (boundaries, cycles, purity) [`biome.json`](../../biome.json) (format, lint, no `export default`) and [`scripts/conventions/`](../../scripts/conventions/conventions.mjs) (the rules that are not imports: `src/` layout, folder size, routers that only list, `c.env` reads, database bindings, provider hosts, handwritten texts, arbitrary values, page classes, export patterns and re-exports). Do not restate those rules in code review.

## Layout

- The top level of each app's `src/` is directly the domains (same names as [`docs/domains/`](../domains/README.md)). Every folder there is a domain except `_shared/`. No technical-layer folders (`controllers/`, `services/`).
- A domain holds its use cases, its data and `errors.ts`. The use case is the unit, in business language (`verify-code`, `invite-member`); the endpoint is the technical term for the HTTP route its `.route.ts` exposes (the person, 2026-11-24).
- `_shared/` holds code no single domain owns: `http/problem-json.ts`, `ids/`, the adapters and technical capabilities such as `rate-limit/`, which may have their own repo (the person, 2026-11-23); `tenancy/` reads the `shards` row and gives the company shard client. It imports no domain.
- Example: `apps/api/src/companies/companies.router.ts`, `companies/invitations/invite-member/invite-member.logic.ts`, `companies/data/invitation.d1.repo.ts`.
- Pure core (no I/O, shared by API, web and the future mobile app) goes in `packages/domain/<domain>/`: Zod schemas, rules, permissions (`can`), error codes, values (`Email`, `Slug`, `Money`). It imports no Hono, Drizzle, React, `fetch` or `apps/`. `apps/api` keeps routes, use cases and repos; `apps/web` keeps pages; hooks live in `packages/app-core` and do not touch the DOM.
- A domain imports only the top-level files of another domain, never its internals.
- Internal packages by name (`@workampo/…`); no barrel files that re-export everything; no cycles.

## Layout of a domain across packages and apps

The same domain and feature folders everywhere, with identical feature names in every package and app (the person, 2026-11-22). Example, `access` with its features `sign-in` and `session`:

```
packages/domain/src/_shared/     identity.ts, choose-provider.ts     the identity seam's types, shared by every domain
packages/domain/src/access/      errors.ts                  what the whole domain shares (errors, types, values)
  sign-in/  session/             pure business rules and their tests
packages/app-core/src/access/
  data/                          sign-in.api.ts, session.api.ts (the hc calls) and query-keys.ts
  sign-in/
    verify-code/                 verify-code.hook.ts (use-case hook), verify-code.form.ts
    code/                        code.hook.ts (page hook: useCodePage); no DOM, no router; shared by web and mobile
packages/i18n/src/locales/<lang>/access.json   texts grouped by screen, plus `errors`; `_context/access.json` for translators
apps/api/src/access/             access.router.ts (lists the features), errors.ts, require-session.middleware.ts (what other domains use)
  data/                          one repo per table: user.d1.repo.ts, identity.d1.repo.ts, session.d1.repo.ts
  sign-in/                       sign-in.router.ts (lists its use cases' routes), complete-sign-in.logic.ts (logic its use cases share)
    start-code/                  start-code.route.ts (POST /sign-in-codes), start-code.logic.ts, start-code.int.test.ts
apps/web/src/access/             access.route.ts (gathers its features' routes)
  sign-in/                       sign-in.route.ts (URLs of the feature)
    code/                        code.page.tsx (the root of /login/code), code-form.tsx (a piece of that page)
apps/mobile/src/access/          when the app arrives: the same folders, `<page>.screen.tsx` as the root, the same hooks from packages/app-core
```

`packages/ui/src/` is not per domain: it is grouped by component family in folders that mirror the headings of [components.md](../design/components.md) (`actions/`, `forms/`, `content/`, `brand/`…), each component with its test beside it, and imported per family: `@workampo/ui/forms` (the person, 2026-11-22).

The root of a package or app holds only configuration, generated files and the folders an external tool reads as they are (`migrations/`, `seed/`, `backfills/`, `public/`, `e2e/`, `test/` setup) (the person, 2026-11-22). Everything our code imports, code or data such as translations and styles, lives in `src/`, in every package and app; inside `src/` there are only `_shared/` and one folder per domain (or per family in `packages/ui`), so the tree reads the same however many domains there are (the person, 2026-11-23). Two written exceptions (the person, 2026-11-24): `packages/ui/src/styles/`, the tokens and CSS every family uses; and `packages/i18n/src/`, a one-purpose package whose "domains" are the JSON files of `locales/`, so its few modules sit at the root of `src/`. `packages/db` keeps `schema/` at its root, a folder drizzle-kit reads; one schema per engine, the engine in the name ([ADR-0077](../adr/0077-database-engines-behind-the-repos.md)).

The root of `src/` also holds the files that gather every domain, because `_shared/` may not import domains: `apps/web/src/route-tree.ts` (the person, 2026-11-22), `apps/api/src/index.ts` and `contract.ts`, and `packages/domain/src/errors.ts` with the union of every domain's error codes (the person, 2026-11-23).

A folder with more than 8 code files, tests not counted, is split into subfolders by feature or use case (the person, 2026-11-23).

### API routing (the person, 2026-11-23)

`index.ts` → `<domain>/<domain>.router.ts` → `<feature>/<feature>.router.ts` → `<use-case>/<use-case>.route.ts`. The routers only list (the person, 2026-11-24).

Entry, logic and data are apart at a glance; the role goes after a dot, as in `.test.ts` (the person, 2026-11-24):

- **Entry** `<use-case>.route.ts`: a Hono sub-app with the one endpoint the use case exposes; a flow that needs two endpoints is two use cases (`google-start`, `google-callback`). It validates, calls its logic and answers; it never touches a repo (dependency-cruiser).
- **Logic** `<use-case>.logic.ts`: every use case has one, however short. It orchestrates the domain rules, the providers and the repos, and knows no Hono (dependency-cruiser). Logic several use cases of a feature share sits at the feature's root (`complete-sign-in.logic.ts`).
- **Data** `<table>.<provider>.repo.ts`, one per table, all in `<domain>/data/`: only Drizzle, no rules; the only files that touch the database (dependency-cruiser). A repo may also hold an atomic write across the domain's tables (`sign-in.d1.repo.ts`). A domain reads only its own tables: another domain asks its logic.
- Inside a use case's folder every file carries the use case's name (`verify-code.route.ts`, `verify-code.logic.ts`, `verify-code.int.test.ts`). HTTP helpers of a feature also say their role: `session.cookie.ts`, `require-session.middleware.ts`.

### API URLs and contracts (ADR-0078)

Why and the guides behind each rule: [ADR-0078](../adr/0078-api-urls-contracts-and-behaviour.md). "Check" is tested over `app.routes` in `apps/api/src/index.int.test.ts`; "review" is in [review](review.md).

| Topic | Rule | Example | Checked by |
|---|---|---|---|
| Company space | Only `/api/t/:slug/…`, behind session and membership | `GET /api/t/:slug/members` | check |
| Outside a company | `/api/<plural>`; never `/api/companies/:x/…` on the app Worker | `POST /api/companies` | check |
| Segments | kebab-case nouns, plural collections; params `:id`, `:<x>Id` | `/units/:id`, `/units/:unitId/…` | check |
| Depth | At most two ids after the tenant; a child of two parents is flat with a query filter | `/assignments?memberId=` | check (depth), review |
| Singletons and aliases | No id, get and patch only; `me` is my item, `current` my session | `/api/me`, `DELETE /t/:slug/members/me` | review |
| Actions | A state change with its own rule, permission, log or conflict is `POST …/:id/<verb>`, the last segment only | `POST /t/:slug/units/:id/move` | check (last segment), review |
| Methods | GET, POST, PATCH (merge), DELETE; PUT only for a binary singleton | `PUT /t/:slug/logo` | check |
| Create | 201 with the resource; `Idempotency-Key` (UUID) required | `POST /api/companies` | check (key), review |
| Not yours, not allowed | 404 with the same body for what you cannot see; 403 `<domain>.forbidden` for what you see but may not do | another company → 404 | check (tenant routes), review |
| Invalid, conflict, limit | 400 `<domain>.<reason>` with optional `errors[{pointer, code}]`; 409 for state, last owner or stale `version`; 422 only for a reused key with another body; 429 with `Retry-After` | `companies.slug_taken` | check (status map), review |
| Errors | Every `/api` 4xx and 5xx is problem+json with `type`, `title`, `status`, `code` | — | check |
| Bodies | JSON objects, camelCase, every field present (`null`, `[]`); built field by field; strict requests | `{ "logoUrl": null }` | review |
| Types | UUIDv7 ids; `…At` ISO UTC; `…On` `YYYY-MM-DD`; `amountCents` and `currency`; snake_case enums | `createdAt` | review |
| Lists | `page` (from 1) and `size` (50, at most 100) → `{ items, total }`, the same names in the web's URL and the API; only the repo turns them into `offset`; a very large table may take a cursor → `{ items, nextCursor }` by an ADR Update; filters by field name, `q`, `sort=-field` | API `GET /api/t/:slug/members?page=2&size=50`; web `/c/:slug/members?page=2&size=50` | review |
| Edits | PATCH with `version`; a mismatch is 409 `<domain>.stale_version` | — | review |
| Bulk and long work | `{ items }` up to 50, all or nothing; long work 202 with `Location: …/jobs/:id` | `POST /t/:slug/invitations` | review |
| Headers | `Cache-Control: no-store`, `nosniff`; the request id is `cf-ray`; no personal data in logs | — | check (headers) |
| Evolution | Only add; deprecate with `Deprecation` and `Sunset`; no version in the URL | — | review |

### Web routing (the person, 2026-11-22)

`main.tsx` → `_shared/providers/app-providers.tsx` → `_shared/router/` → `route-tree.ts` → `<domain>/<domain>.route.ts` → `<feature>/<feature>.route.ts` → pages.

1. A feature's route file declares its URLs, validates search params and points to its pages with a lazy `import()`; nothing visual. The domain's route file only gathers its features' routes; `route-tree.ts` gathers the domains.
2. A paged list keeps `page` (from 1) and `size` in its search params, validated by the route, and passes them as they are to the API, which uses the same names (ADR-0078, the person, 2026-11-25).
3. A page is imported only by its own feature's route file, always lazily; nothing else imports it (it would land in the importer's chunk), and a page does not know its URL. dependency-cruiser enforces it.

### Pages, hooks and data in the clients (the person, 2026-11-24)

The web and the mobile app mirror the API: the view, its logic and the data are apart at a glance.

- **Page**: the root of a URL is `<page>.page.tsx` in the web and `<page>.screen.tsx` in the mobile app, in a folder with the page's name; only UI and what belongs to its platform (focus, keyboard, `<Navigate>`). Its pieces are components without a role suffix (`code-form.tsx`) in the same folder; if several pages of the feature use one it moves to the feature's root, across domains to `_shared/components/`, and generic ones to `packages/ui` (dependency-cruiser keeps a page's pieces in its folder).
- **Page hook** `<page>/<page>.hook.ts` in `packages/app-core` (`code/code.hook.ts`, `useCodePage`): combines use-case hooks, the form and the page's rules (what resets, which message shows, when it is done), and returns i18n keys, not texts. It knows no router and no DOM: navigation arrives as a callback (`onSignedIn`), so the mobile app reuses it (dependency-cruiser). Only when the page has logic of its own.
- **Use-case hook** `<use-case>/<use-case>.hook.ts` in `packages/app-core`, mirroring the API's use case (`verify-code/verify-code.hook.ts`): wraps one call (query or mutation, keys, invalidation), with its `queryOptions` if the router needs them; it never knows a page. Its form schema beside it: `<use-case>.form.ts`.
- **Data** `<domain>/data/<resource>.api.ts`: the `hc` calls, and `query-keys.ts`. Only these files and the client's own module use `hc`; the apps never import `hono` (dependency-cruiser).
3. Moving between screens goes through typed URLs (`navigate({ to: '/login/code' })`, `<Link to>`), never by importing another screen.
4. Data never passes between screens by import: through the app-core query cache or the URL; router history state only for values that must stay out of the URL, such as the sign-in email.
5. A feature may use a component of another feature of its domain (home uses session's sign-out button); across domains it may not (dependency-cruiser), and the component is promoted to `_shared/components/` or `packages/ui`.

## Names

A file is not named only by its kind when that name repeats in other folders: `sign-in.api.ts`, `me.hook.ts`, `sign-in.router.ts`, not `api.ts`, `hook.ts`, `router.ts` (the person, 2026-11-22). Exception: `errors.ts` at the root of a domain keeps one fixed name in every domain, and so does `query-keys.ts` in each domain's `data/` in `packages/app-core`: every TanStack Query key of the domain lives there, and hooks import keys from it, never from another hook (the person, 2026-11-22).

- The suffix after the dot says the type of what is inside, always in the singular, not how many: `.page`, `.screen`, `.hook`, `.api`, `.form`, `.route`, `.router`, `.logic`, `.repo`, `.cookie`, `.middleware`, `.contract`, `.test` (the person, 2026-11-24).
- A file that uses a provider names it, even when it is the only one: services, engines and infrastructure we could change (database, identity, email, payments, error tracking, analytics, storage, Cloudflare's own APIs), not the base frameworks used directly (Hono, React, TanStack, Drizzle, Zod, i18next). `user.d1.repo.ts`, `cloudflare-request-origin.ts`, `sentry-error-tracking.ts`; dependency-cruiser checks it for D1 (the person, 2026-11-24).

- No barrel `index` files: a package's entries are only those declared in its `exports`. A package exports only what other packages and apps may use; internals (`*.api.ts`, forms, use-case hooks only pages use) and test helpers stay unexported (the person, 2026-11-22). Every entry is named in `exports`, never a `"./*"` pattern; the only re-exporting files are the entry of each `packages/ui` family (`forms.ts`, `actions.ts`…) (the person, 2026-11-23).
- Seeds are numbered like migrations: `NNNN-<domain>.sql`, four digits (the person, 2026-11-22).
- Test files (the person, 2026-11-22): a unit test is `<source>.test.ts`; a feature's HTTP test `<feature>.router.int.test.ts`, or `<spec-topic>.int.test.ts` when it covers a rule of the living spec; a use case's test `<use-case>.int.test.ts` in its folder (the person, 2026-11-23); acceptance scenarios always in `e2e/acceptance/<topic>.e2e.ts` (`e2e/health.e2e.ts` stays as infrastructure); they go with what they cover: journeys through the pages in `apps/web/e2e/`, server behaviour (cookies, limits, linking, `/health`) in `apps/api/e2e/`; both suites start the same API Worker, which serves the web (the person, 2026-11-24).
- The brand "worKampo" is not translated (the person, 2026-11-22).

| What | Rule | Example |
|---|---|---|
| Files, folders | `kebab-case` (only exception: `_shared/`) | `invite-member/invite-member.logic.ts` |
| Tests | same name + `.test.ts`; integration `.int.test.ts` | `session.router.int.test.ts` |
| Components | `PascalCase`, file in kebab | `MemberDrawer` in `member-drawer.tsx` |
| Hooks | `use` + camelCase | `useMembers` |
| Functions, variables | `camelCase`; verb for actions | `inviteMember()` |
| Booleans | `is` / `has` / `can` | `isOwner`, `canInvite` |
| Types | `PascalCase`, no `I` prefix | `InviteMemberInput` |
| Zod schemas | camelCase + `Schema`; infer the type | `inviteMemberSchema` |
| Constants | `UPPER_SNAKE_CASE` | `INVITATION_TTL_DAYS` |
| Exports | named only | `export function …` |
| Internal packages | `@workampo/…` | `@workampo/db` |
| Tables, columns | plural, `snake_case` | `invitations`, `expires_at` |
| Migrations | number + verb + object | `0007_create_invitations.sql` |
| API routes | plural, kebab-case ([API URLs and contracts](#api-urls-and-contracts-adr-0078)) | `POST /api/t/:slug/invitations/:id/resend` |
| Error codes | `domain.reason` | `companies.invitation_expired` |
| i18n keys | `domain.screen.element` | `companies.members.invite_button` |
| Analytics events | `object_action` | `member_invited` |
| Env vars, bindings | `UPPER_SNAKE_CASE` | `DB_GLOBAL` |

Use one name end to end: living-spec rule (`@id:companies-15-1`) → use case → test citing the `@id` → error code → i18n key.

## Errors

- One error class per domain, with its code: `AccessError(code)` in `apps/api/src/access/errors.ts`, which also holds each code's HTTP status (the person, 2026-11-22).
- Adapters throw neutral errors of their capability (`InvalidCodeError`, never an `access.*` code); the use case translates them into the domain's error (the person, 2026-11-22).
- The union of every domain's codes is `packages/domain/src/errors.ts`; the API, app-core and the texts' test read it (the person, 2026-11-22).
- The web and the mobile app call the API only through the hooks of `packages/app-core`, never `fetch` or the `hc` client in a screen. Every failure reaches them as an `ApiError` with a domain code (`_shared/api-error.ts`); a screen only turns it into its text with `errorKeyOf`, from the public entry `@workampo/app-core/errors` (the person, 2026-11-23).
- Translate to HTTP in one place, `_shared/http/problem-json.ts`: `problem+json` (RFC 9457) with a stable `code` the interface translates.

## Data access

- Always through the domain's `data/<table>.d1.repo.ts`; explicit columns, never `SELECT *`; every list has a maximum page size; no queries in a loop.
- Repos receive the company's database client from `_shared/tenancy/` once the company shard exists (today `_shared/db/d1-global-db.ts`); never use the D1 binding directly.
- Drizzle builder only; no SQLite-specific SQL (`strftime`, JSON functions, `ROWID`, `AUTOINCREMENT`). If unavoidable, isolate it and comment why.
- Split long lists (many parameters, big `batch()`) inside the repo (D1 limits).
- Text search through a normalized lowercase column, not `COLLATE NOCASE`; escape `LIKE` wildcards. Alphabetical order by the normalized column.
- Anything atomic is one repo function that receives what was decided and runs it all at once (`batch()` in D1, a transaction in another engine); logic never composes unexecuted queries, and a repo turns an engine error the logic must react to into a neutral error ([ADR-0077](../adr/0077-database-engines-behind-the-repos.md)).
- Drizzle `casing: 'snake_case'`: write camelCase once in TypeScript.
- Migrations: one change each, an applied one is never edited ([ADR-0033](../adr/0033-expand-contract-migrations.md), [ADR-0044](../adr/0044-migrations-reference-data-seeds-and-backfills.md)).

### Tables

- `tenant_id` on every company table; indexes on company tables start with `tenant_id`.
- Name the table by its glossary concept (`members`, not `company_users`). Technical link without a name: `<entity>_<entities>`. 1:1 extension: `<entity>_<aspect>` in plural.
- Which database: `DB_GLOBAL` holds what is needed before knowing the shard or between companies (users, sessions, registry with name and logo, `members`, `invitations`, billing, plans, flags, staff); the shard holds what the company creates. Declare each table in `schema/global.d1.ts` or `schema/shard.d1.ts`, one schema per engine ([ADR-0077](../adr/0077-database-engines-behind-the-repos.md)) ([ADR-0053 section](../adr/0053-code-conventions.md) has the full list).
- Deleting a company touches two databases: mark it "being deleted" first, then a Workflow purges the shard, then the global data.

| Topic | Rule |
|---|---|
| Primary key | `id` UUIDv7 without prefix, generated by the app, when the row is addressed by URL/API or referenced. Composite key on 1:1 extensions and never-addressed links. In the shard the key is `id` alone |
| References | `<entity>_id` singular; the company is always `tenant_id`; across databases only the ID, no foreign key |
| Booleans | `is_` / `has_` |
| Instants, dates | `_at` instants (ISO text, UTC); `_on` dates without time |
| `created_at` | On every table, set by the app; technical tables such as rate-limit counters go without it (the person, 2026-11-23) |
| `updated_at`, `updated_by` | On tables people edit; equal to creation the first time |
| Author | No generic `created_by`; only domain-named authors the product shows (`invited_by`) |
| `status` | Only with a lifecycle, domain values, and a `CHECK` |
| Enumerations | Text with `CHECK`; no magic numbers |
| JSON | Only for free-form structure; validate with Zod on read and write |
| Money | `amount_cents` (integer) + `currency` |
| Emails | Normalized lowercase column with a unique index |
| Nulls | `NOT NULL` by default; nullable only if empty means something |
| Lengths | Validated with Zod |

- Indexes: `idx_<table>__<columns>`, `uq_<table>__<columns>`; index every reference column; uniqueness per company where it applies.
- Concurrency: a `version` integer on whatever is edited on screen; write with `WHERE version = ?` and warn the user if nothing updates.
- Deletion: real delete by default, with its `audit_events` row. Soft delete only where the product offers undo or restore, as a `status` value (`archived` / `deleted` + `deleted_at`); the repo filters it by default, unique indexes are partial, a Workflow purges after N days.
- History: `audit_events` is append-only (`id`, `tenant_id`, `actor_id`, `action`, `target_type`, `target_id`, `changes`, `request_id`, `created_at`). Each database records its own changes in the same atomic write of the repo (`batch()` in D1, a transaction in another engine), no triggers. `changes` holds ids and changed fields only, no copied personal data, never secrets.
- Tests: each integration test starts from a clean database with migrations applied, data from the factories ([ADR-0029](../adr/0029-testing-strategy.md)).

## IDs, dates, money

- IDs: UUIDv7 generated by the app (`_shared/ids/`), branded types (`CompanyId`, `UserId`).
- Dates: UTC and ISO 8601 in the database and the API; format only in the interface with `Intl`.
- Money: integer minor units plus currency; format only in the interface with `Intl`.

## Validation, config, imports

- Zod only at the boundaries (API input, forms, environment variables). Types inferred from Zod and Drizzle, never duplicated by hand.
- Bindings and variables typed and validated in `env.ts`; no loose reads of variables elsewhere. The environment is parsed once per request by a middleware into `c.var.env`, and its types have one source, `env.ts` (the person, 2026-11-22). Only the deploy metadata (`ENVIRONMENT`, `APP_VERSION`, `GIT_SHA`, `CF_VERSION_METADATA`) is read from the raw bindings, by `/health`, the version header and error tracking, so they answer even when the configuration fails to parse (the person, 2026-11-23).
- Utilities without I/O of one capability live in `_shared/<capability>/`: `crypto/` (random tokens, SHA-256), `http/request-origin.ts` with the one `RequestOrigin` type (the person, 2026-11-22).
- The API's typed contract is `@workampo/api/contract` (type-only `AppType`); clients import that, never a path into `apps/` (the person, 2026-11-22).
- Local secrets only in `.dev.vars` (ignored); commit `.dev.vars.example` with names, no values. Staging/production secrets via `wrangler secret` and GitHub Environments. Public config in `vars` of `wrangler.jsonc`; no `.env.<environment>` files.

## Permissions

- Actions are born in code with their scope (company or unit) and an immutable key; roles and what they allow live in the database; assignments tie a member, a role and a unit ([ADR-0072](../adr/0072-organization-units-and-scoped-roles.md)) (the person, 2026-11-23).
- Effective permissions are the union of the active assignments on the unit and its ancestors, computed on each request and never stored. `can(member, action, unit)` is a pure function in `packages/domain`; the API loads the data and decides, the interface uses the same function only to show or hide. A company-scope action is checked on the root.

## External dependencies

- Provider services and libraries (auth, payments, email, error tracking, analytics, Cloudflare non-database APIs): behind our own adapter per capability, named for what it does (`_shared/identity/`, `_shared/payments/`, `_shared/email/`, `_shared/error-tracking/`). Expose our own types, ship a fake for tests. Adapters live in `apps/<app>/src/_shared/<capability>/`; they move to `packages/integrations/` when several apps need them.
- Base frameworks (Hono, React, Zod, Drizzle, router, frontend state): use directly. UI components come only from `packages/ui`.
- Utilities (dates, IDs, money, slugs): own helpers in `_shared/` over `Intl` and `crypto`; no library unless needed.
- Classify every new dependency in the PR: provider (with an adapter and a dependency-cruiser rule) or base (with a reason).
- Webhooks: each provider has an event → handler registry in its adapter, with a test that every event is registered exactly once. Order: verify signature, validate payload with Zod, check idempotency (processed IDs in `DB_GLOBAL`), call the use case.

## Interface

- All CSS lives in `packages/ui/src/styles/`; apps import `@workampo/ui/styles.css` (the person, 2026-11-22).
- Typography through `Text` and `TextLink` of `packages/ui`; screens carry no typography classes (the person, 2026-11-22). Nor layout classes: a form is `Form` of `packages/ui` (fields 16 px apart, the browser's validation off) (the person, 2026-11-23).
- Styles: only tokens ([`packages/ui/src/styles/tokens.css`](../../packages/ui/src/styles/tokens.css)) and Tailwind scale classes; no arbitrary values (`text-[20px]`), in `packages/ui` either: a size or shadow the scale lacks becomes a token (`text-body`, `--shadow-focus`) (the person, 2026-11-23). What `packages/ui` uses inside, such as `cx`, lives in its `src/_shared/`.
- Texts through i18n keys, never literals ([ADR-0047](../adr/0047-i18n-from-the-start.md)).
- Search `packages/ui` and [`docs/design/components.md`](../design/components.md) before creating a component.
- Load only what a screen needs (the person, 2026-11-22; [ADR-0073](../adr/0073-frontend-stack-and-rate-limiting.md) point 4):
  - Every route is lazy (`.lazy(() => import(...))`, one split per screen) and the router preloads on intent.
  - Heavy pieces inside a screen (editors, charts, maps, date pickers) are imported when opened, with a skeleton meanwhile.
  - Translations load per language and namespace on demand; never import a locale file statically in the web.
  - The initial JS of `/login` and of the signed-in shell stays under the budget the web check enforces.
- Where state lives (the person, 2026-11-22; [ADR-0073](../adr/0073-frontend-stack-and-rate-limiting.md) point 5):
  - Server data: only the TanStack Query cache of `packages/app-core`; never copied into context or `useState`.
  - Shareable or restorable state (company, filters, search, page, sort, open drawer): the URL.
  - UI state: local `useState`, lifted only as far as needed. Form state: react-hook-form in its screen.
  - Context: only rarely-changing app-wide values not from the server (router, query and i18n providers, theme, toast queue), in `apps/web/src/_shared/providers/` with a one-line why. Exception: `packages/app-core/src/_shared/` defines the contexts of its own dependency injection (the API client); each app mounts their providers in its `_shared/providers/app-providers.tsx`.
  - Shared or persisted client state: a Zustand store in `packages/app-core` with injected storage, versioned with a migration; never personal data, tokens or server data. No other global state library without an ADR.

| Level | Where | Rule |
|---|---|---|
| Global | `packages/ui` | No business knowledge; data and texts by props; no server fetching; accessible; component tests; documented in `components.md` |
| App-shared | `apps/<app>/src/_shared/components/` | Knows the app, not a domain |
| Feature | inside its domain | Thin: composes global components with the domain's data; no own styles |

- Promotion: what already exists in the design system is global from day one. What is born in a feature stays there until its second real use, then moves to `_shared/` or `packages/ui` in the same PR. Never generalize a single use.
- Route files (`_shared/router/`, every `<domain>.route.ts` and `<feature>.route.ts`) only map URLs to page components and set route options (lazy import, loaders, guards, search validation, preload): no markup, no `className`, no inline JSX layout. A layout is a component in its own file (the person, 2026-11-22).

## Tests placement

- Setup of a package's tests in `<package>/test/setup.ts`; helpers tests import in `src/_shared/testing/` (API: `newEmail`, `signIn`, `expectProblem`…). The fake provider's fixtures come from `fake-identities.ts`, never copied (the person, 2026-11-22).
- Unit next to the code (`x.test.ts`), integration `*.int.test.ts` beside the code it covers (the use case's folder, or the feature's root for a flow); strategy in [ADR-0029](../adr/0029-testing-strategy.md). Each approved living-spec example has a test that cites its `@id`.

## Blank lines

Biome keeps blank lines but never adds them; apply this by hand (the person, 2026-11-22):

- One blank line separates logical blocks: after a group of guard clauses and the values they lead to; before and after an `if`, `for`, `while`, `try` or `switch` whose body spans several lines; before the final `return` of a function with other statements before it.
- A single-statement `if` stays on one line when it fits; otherwise Biome puts the body on its own indented line.
- No blank line right after an opening brace or right before a closing one.

## Code shape

Rules of the person (2026-11-22). Biome enforces 3, 4 and 6 (`noUselessElse`, `useMaxParams` with `max: 2`, `noNestedTernary`); in `scripts/`, whose older tooling predates them, only 3 applies; the rest is by hand.

1. **File order**: imports, constants, then what the file exports, then its private helpers.
   ```ts
   const HOUR = 3600
   export function hitRateLimit() { … sha256Hex(subject) … }
   async function sha256Hex(text: string) { … }
   ```
2. **Use case sections**, each separated by a blank line: validate input, load, decide (the pure domain rule), persist, respond.
   ```ts
   const input = verifyCodeSchema.parse(body)

   const [userBySubject, userByEmail] = await Promise.all([…])

   const decision = decideSignIn({ identity, userBySubject, userByEmail })

   await repo.batch(…)

   return c.json({ user }, 201)
   ```
3. **Early returns, not nesting**: the conditions that cut go first and the normal path stays unindented; no `else` after a `return`.
   ```ts
   if (!session) return problemJson('access.unauthenticated')

   return next()
   ```
4. **More than two parameters → one named object**, so call sites read `rateLimitKey({ purpose, subjectKind, subjectHash })`.
5. **Tests in three sections** separated by a blank line: arrange, act, assert. The test name cites the example it covers as `@id:access-96-9`, the form `pnpm check:pr` looks for.
   ```ts
   it('@id:access-96-9 an unverified email is refused', async () => {
     const identity = unverifiedIdentity()

     const decision = decideSignIn({ identity, userBySubject: null, userByEmail: null })

     expect(decision).toEqual({ kind: 'refuse', code: 'access.email_not_verified' })
   })
   ```
6. **No nested ternaries**: a ternary picks between two cases; more cases use early-return `if`s or a lookup map.
   ```ts
   const STATUS_BY_CODE = { 'access.invalid_code': 400, 'access.too_many_attempts': 429 }
   ```

## Logs and comments

- Logs: structured JSON with request id and company id, no personal data. Errors go to Sentry through its adapter, sent with `ctx.waitUntil`.
- Comments: English, only for the why. Workarounds for free-plan limits carry the `paid-plan(<decision>)` mark ([ADR-0056](../adr/0056-async-work.md)). No ticket references ([traceability](../procedures/traceability.md)).

## Decided later

Use of feature flags in code. Do not invent a convention for these: it is decided with the first PRD that needs it.
