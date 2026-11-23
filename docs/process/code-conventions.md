# Code conventions

Rules an implementer applies. Why: [ADR-0053](../adr/0053-code-conventions.md) (also [ADR-0054](../adr/0054-roles-and-permissions.md), [ADR-0057](../adr/0057-ready-for-a-mobile-app.md)). Enforced by `pnpm check`: [`.dependency-cruiser.cjs`](../../.dependency-cruiser.cjs) (boundaries, cycles, purity) and [`biome.json`](../../biome.json) (format, lint, no `export default`). Do not restate those rules in code review.

## Layout

- The top level of each app's `src/` is directly the domains (same names as [`docs/domains/`](../domains/README.md)). Every folder there is a domain except `_shared/`. No technical-layer folders (`controllers/`, `services/`).
- A domain holds routes, use cases, repos, `errors.ts` and tests side by side. One use case per file.
- `_shared/` holds code no single domain owns: `http/problem-json.ts`, `tenancy/`, `ids/`, and the adapters. It imports no domain.
- Example: `apps/api/src/companies/routes.ts`, `companies/invitations/invite-member.ts`, `invitation-repo.ts`.
- Pure core (no I/O, shared by API, web and the future mobile app) goes in `packages/domain/<domain>/`: Zod schemas, rules, permissions (`can`), error codes, values (`Email`, `Slug`, `Money`). It imports no Hono, Drizzle, React, `fetch` or `apps/`. `apps/api` keeps routes, use cases and repos; `apps/web` keeps screens and hooks. Web data hooks do not touch the DOM.
- A domain imports only the top-level files of another domain, never its internals.
- Internal packages by name (`@workampo/…`); no barrel files that re-export everything; no cycles.

## Layout of a domain across packages and apps

The same domain and feature folders everywhere, with identical feature names in every package and app (the person, 2026-11-22). Example, `access` with its features `sign-in` and `session`:

```
packages/domain/src/access/      errors.ts, identity.ts     what the whole domain shares (errors, types, values)
  sign-in/  session/             pure business rules and their tests
packages/app-core/src/access/    query-keys.ts: every query key of the domain
  sign-in/  session/             data hooks (`<feature>-hooks.ts`) and form schemas; no DOM; shared by web and mobile
packages/i18n/src/locales/<lang>/access.json   texts grouped by screen, plus `errors`; `_context/access.json` for translators
apps/api/src/access/             routes.ts (mounts the features), errors.ts
  sign-in/  session/             the feature's routes, use cases, repos and tests
  users/                         a repo several features share
apps/web/src/access/             routes.ts (gathers its features' routes)
  sign-in/                       sign-in-routes.ts and one file per screen (`login-screen.tsx`); screen-only components beside it until a second use promotes them to packages/ui
apps/mobile/src/access/          when the app arrives: the same feature folders, its own views, the same hooks from packages/app-core
```

`packages/ui/src/` is not per domain: it is grouped by component family in folders that mirror the headings of [components.md](../design/components.md) (`actions/`, `forms/`, `content/`, `brand/`…), each component with its test beside it, and imported per family: `@workampo/ui/forms` (the person, 2026-11-22).

The root of a package or app holds only configuration, generated files and the folders an external tool reads as they are (`migrations/`, `seed/`, `backfills/`, `public/`, `e2e/`, `test/` setup) (the person, 2026-11-22). Everything our code imports, code or data such as translations and styles, lives in `src/`, in every package and app; inside `src/` there are only `_shared/` and one folder per domain (or per family in `packages/ui`), so the tree reads the same however many domains there are (the person, 2026-11-23). `packages/db` keeps `schema/` at its root while the spike of issue 112 decides how the schema is declared.

The root of `src/` also holds the files that gather every domain, because `_shared/` may not import domains: `apps/web/src/route-tree.ts` (the person, 2026-11-22), `apps/api/src/index.ts` and `contract.ts`, and `packages/domain/src/errors.ts` with the union of every domain's error codes (the person, 2026-11-23).

A folder with more than 8 code files, tests not counted, is split into subfolders by feature or use case (the person, 2026-11-23).

### Web routing (the person, 2026-11-22)

`main.tsx` → `_shared/providers/app-providers.tsx` → `_shared/router/` → `route-tree.ts` → `<domain>/routes.ts` → `<feature>/<feature>-routes.ts` → screens.

1. A feature's routes file declares its URLs, validates search params and points to its screens with a lazy `import()`; nothing visual. The domain's `routes.ts` only gathers its features' routes; `route-tree.ts` gathers the domains.
2. A screen is imported only by its own feature's routes file, always lazily; nothing else imports it (it would land in the importer's chunk), and a screen does not know its URL. dependency-cruiser enforces it.
3. Moving between screens goes through typed URLs (`navigate({ to: '/login/code' })`, `<Link to>`), never by importing another screen.
4. Data never passes between screens by import: through the app-core query cache or the URL; router history state only for values that must stay out of the URL, such as the sign-in email.
5. A feature may use a component of another feature of its domain (home uses session's sign-out button); across domains it may not (dependency-cruiser), and the component is promoted to `_shared/components/` or `packages/ui`.

## Names

A file is not named only by its kind when that name repeats in other folders: `sign-in-api.ts`, `session-hooks.ts`, `sign-in-routes.ts`, not `api.ts`, `hooks.ts`, `routes.ts` (the person, 2026-11-22). Exception: the convention files at the root of a domain keep one fixed name in every domain (`errors.ts`, and `routes.ts` in the apps), because that fixed name and place make the layout predictable. The same goes for `query-keys.ts` at the root of each domain in `packages/app-core`: every TanStack Query key of the domain lives there, and hooks import keys from it, never from another feature's hooks (the person, 2026-11-22).

- Hooks files are `<feature>-hooks.ts`; screens `<name>-screen.tsx` (the person, 2026-11-22).
- No barrel `index` files: a package's entries are only those declared in its `exports`. A package exports only what other packages and apps may use; internals (`*-api.ts`) and test helpers stay unexported (the person, 2026-11-22).
- Seeds are numbered like migrations: `NNNN-<domain>.sql`, four digits (the person, 2026-11-22).
- Test files (the person, 2026-11-22): a unit test is `<source>.test.ts`; a feature's HTTP test `<feature>-routes.int.test.ts`, or `<spec-topic>.int.test.ts` when it covers a rule of the living spec; acceptance scenarios always in `e2e/acceptance/<topic>.e2e.ts` (`e2e/health.e2e.ts` stays as infrastructure).
- The brand "worKampo" is not translated (the person, 2026-11-22).

| What | Rule | Example |
|---|---|---|
| Files, folders | `kebab-case` (only exception: `_shared/`) | `invite-member.ts` |
| Tests | same name + `.test.ts`; integration `.int.test.ts` | `routes.int.test.ts` |
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
| API routes | plural, kebab-case | `POST /api/t/:slug/invitations/:id/resend` |
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

- Always through the domain's `*-repo.ts`; explicit columns, never `SELECT *`; every list has a maximum page size; no queries in a loop.
- Repos receive the company's database client from `_shared/tenancy/`; never use the D1 binding directly.
- Drizzle builder only; no SQLite-specific SQL (`strftime`, JSON functions, `ROWID`, `AUTOINCREMENT`). If unavoidable, isolate it and comment why.
- Split long lists (many parameters, big `batch()`) inside the repo (D1 limits).
- Text search through a normalized lowercase column, not `COLLATE NOCASE`; escape `LIKE` wildcards. Alphabetical order by the normalized column.
- Anything atomic goes in a single `batch()`.
- Drizzle `casing: 'snake_case'`: write camelCase once in TypeScript.
- Migrations: one change each, an applied one is never edited ([ADR-0033](../adr/0033-expand-contract-migrations.md), [ADR-0044](../adr/0044-migrations-reference-data-seeds-and-backfills.md)).

### Tables

- `tenant_id` on every company table; indexes on company tables start with `tenant_id`.
- Name the table by its glossary concept (`members`, not `company_users`). Technical link without a name: `<entity>_<entities>`. 1:1 extension: `<entity>_<aspect>` in plural.
- Which database: `DB_GLOBAL` holds what is needed before knowing the shard or between companies (users, sessions, registry with name and logo, `members`, `invitations`, billing, plans, flags, staff); the shard holds what the company creates. Declare each table in `schema/global.ts` or `schema/shard.ts` ([ADR-0053 section](../adr/0053-code-conventions.md) has the full list).
- Deleting a company touches two databases: mark it "being deleted" first, then a Workflow purges the shard, then the global data.

| Topic | Rule |
|---|---|
| Primary key | `id` UUIDv7 without prefix, generated by the app, when the row is addressed by URL/API or referenced. Composite key on 1:1 extensions and never-addressed links. In the shard the key is `id` alone |
| References | `<entity>_id` singular; the company is always `tenant_id`; across databases only the ID, no foreign key |
| Booleans | `is_` / `has_` |
| Instants, dates | `_at` instants (ISO text, UTC); `_on` dates without time |
| `created_at` | On every table, set by the app |
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
- History: `audit_events` is append-only (`id`, `tenant_id`, `actor_id`, `action`, `target_type`, `target_id`, `changes`, `request_id`, `created_at`). Each database records its own changes in the same `batch()` through a repo helper, no triggers. `changes` holds ids and changed fields only, no copied personal data, never secrets.
- Tests: each integration test starts from a clean database with migrations applied, data from the factories ([ADR-0029](../adr/0029-testing-strategy.md)).

## IDs, dates, money

- IDs: UUIDv7 generated by the app (`_shared/ids/`), branded types (`CompanyId`, `UserId`).
- Dates: UTC and ISO 8601 in the database and the API; format only in the interface with `Intl`.
- Money: integer minor units plus currency; format only in the interface with `Intl`.

## Validation, config, imports

- Zod only at the boundaries (API input, forms, environment variables). Types inferred from Zod and Drizzle, never duplicated by hand.
- Bindings and variables typed and validated in `env.ts`; no loose reads of variables elsewhere. The environment is parsed once per request by a middleware into `c.var.env`, and its types have one source, `env.ts` (the person, 2026-11-22).
- Utilities without I/O of one capability live in `_shared/<capability>/`: `crypto/` (random tokens, SHA-256), `auth/state-cookie.ts`, `http/request-origin.ts` with the one `RequestOrigin` type (the person, 2026-11-22).
- The API's typed contract is `@workampo/api/contract` (type-only `AppType`); clients import that, never a path into `apps/` (the person, 2026-11-22).
- Local secrets only in `.dev.vars` (ignored); commit `.dev.vars.example` with names, no values. Staging/production secrets via `wrangler secret` and GitHub Environments. Public config in `vars` of `wrangler.jsonc`; no `.env.<environment>` files.

## Permissions

- Roles and the action → allowed-roles map live in code in the `companies` domain, with one `can(member, action)`; the API decides, the interface uses the same function only to show or hide. Read the role from the database on every request, never from the JWT or a session cache. A unit test walks the whole matrix ([ADR-0054](../adr/0054-roles-and-permissions.md)).

## External dependencies

- Provider services and libraries (auth, payments, email, error tracking, analytics, Cloudflare non-database APIs): behind our own adapter per capability, named for what it does (`_shared/auth/`, `_shared/payments/`, `_shared/email/`, `_shared/error-tracking/`). Expose our own types, ship a fake for tests. Adapters live in `apps/<app>/src/_shared/<capability>/`; they move to `packages/integrations/` when several apps need them.
- Base frameworks (Hono, React, Zod, Drizzle, router, frontend state): use directly. UI components come only from `packages/ui`.
- Utilities (dates, IDs, money, slugs): own helpers in `_shared/` over `Intl` and `crypto`; no library unless needed.
- Classify every new dependency in the PR: provider (with an adapter and a dependency-cruiser rule) or base (with a reason).
- Webhooks: each provider has an event → handler registry in its adapter, with a test that every event is registered exactly once. Order: verify signature, validate payload with Zod, check idempotency (processed IDs in `DB_GLOBAL`), call the use case.

## Interface

- All CSS lives in `packages/ui/src/styles/`; apps import `@workampo/ui/styles.css` (the person, 2026-11-22).
- Typography through `Text` and `TextLink` of `packages/ui`; screens carry no typography classes (the person, 2026-11-22).
- Styles: only tokens ([`packages/ui/src/styles/tokens.css`](../../packages/ui/src/styles/tokens.css)) and Tailwind scale classes; no arbitrary values (`text-[20px]`) outside `packages/ui`.
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
- Route files (`_shared/router/`, every `routes.ts` of a domain or feature) only map URLs to screen components and set route options (lazy import, loaders, guards, search validation, preload): no markup, no `className`, no inline JSX layout. A layout is a component in its own file (the person, 2026-11-22).

## Tests placement

- Setup of a package's tests in `<package>/test/setup.ts`; helpers tests import in `src/_shared/testing/` (API: `newEmail`, `signIn`, `expectProblem`…). The fake provider's fixtures come from `fake-identities.ts`, never copied (the person, 2026-11-22).
- Unit next to the code (`x.test.ts`), integration `*.int.test.ts` in the domain folder; strategy in [ADR-0029](../adr/0029-testing-strategy.md). Each approved living-spec example has a test that cites its `@id`.

## Blank lines

Biome keeps blank lines but never adds them; apply this by hand (the person, 2026-11-22):

- One blank line separates logical blocks: after a group of guard clauses and the values they lead to; before and after an `if`, `for`, `while`, `try` or `switch` whose body spans several lines; before the final `return` of a function with other statements before it.
- A single-statement `if` stays on one line when it fits; otherwise Biome puts the body on its own indented line.
- No blank line right after an opening brace or right before a closing one.

## Code shape

Rules of the person (2026-11-22). Biome enforces 3, 4 and 6 (`noUselessElse`, `useMaxParams` with `max: 2`, `noNestedTernary`) outside `scripts/`, whose older tooling predates them; the rest is by hand.

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

Router, server state and forms of the frontend; pagination, filters and ordering of the API; use of feature flags in code. Do not invent a convention for these: it is decided with the first PRD that needs it.
