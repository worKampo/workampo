---
status: accepted
date: 2026-11-14
---

# ADR-0053: Code conventions

## Context

Decided on 2026-11-13. Operational detail lives in `docs/process/code-conventions.md` (ticket 4 of "Working foundation"), linked from `AGENTS.md`. Whatever can be checked is checked by Biome and dependency-cruiser in `pnpm check` ([ADR-0017](0017-verifiable-harness.md)).

## Decision

- **Organization by domain, not by technical layers**: the top level of each app's `src/` is **directly the domains** (the same ones as `docs/domains/`, [ADR-0052](0052-living-specs-only-and-flow-by-size.md)), with no intermediate folder: routes, use cases, data access, schemas and tests together. Shared code goes in **`src/_shared/`**: the underscore sorts it first and marks it as not a domain (the only exception to `kebab-case`). Rule: every folder in `src/` is a domain except `_shared/`. One use case per file.
  ```
  apps/api/src/
    _shared/
      http/problem-json.ts · tenancy/resolve-tenant.ts · ids/new-id.ts
      email/ · payments/ · auth/ · error-tracking/   adapters (see below)
    access/
    billing/
    companies/
      routes.ts · routes.int.test.ts · errors.ts
      invitations/
        invite-member.ts · invite-member.test.ts
        invitation-repo.ts        data access with mandatory tenant_id
    public-site/
    env.ts · index.ts
  apps/web/src/companies/members/
    members-screen.tsx · member-drawer.tsx · members-routes.ts · members-screen.test.tsx
  ```
  - **Features inside a domain** (the person, 2026-11-22): in `packages/domain`, `apps/api`, `apps/web` and later the mobile app, a domain folder's root holds only what the whole domain shares (its errors, types, values); everything else goes in a subfolder per feature, with the same folder name in every package and app (`access/sign-in/` in domain, API and web). Web screens are imported only lazily by their feature's routes file; hooks are `<feature>-hooks.ts` in `packages/app-core` (the person, 2026-11-22). The canonical tree is in [code conventions](../process/code-conventions.md#layout-of-a-domain-across-packages-and-apps). The root of a package or app holds only configuration, generated files and folders an external tool reads by convention; what our code imports lives in `src/` or the package's own grouping folders (the person, 2026-11-22).
  - **Providers visible in the path** (the person, 2026-11-22): the capability folder is named for what it does; the interface and our types keep neutral names; every implementation file carries the provider's name (`workos-*.ts`, `fake-*.ts`, `d1-*.ts`, `sentry-*.ts`…) or sits in a per-provider subfolder. A file without a provider name never imports or calls a provider.
- **Pure domain core** (2026-11-14, [ADR-0057](0057-ready-for-a-mobile-app.md)): whatever does no I/O and must be shared by the API, the web and the future mobile app (Zod schemas, rules, permissions, error codes, values such as `Email` or `Slug`) lives in `packages/domain/<domain>/`, with the same domain folders. `apps/api` keeps routes, use cases and repos; `apps/web` keeps screens and hooks. That is why the Zod schemas for invitations (`invitation-schemas.ts`) live in `packages/domain/companies/invitations/` and not in the tree above. It holds only business rules (the person, 2026-11-22): no I/O and no technical policies such as rate limiting, retries or caching; technical rules without I/O live in the app's `_shared/<capability>/`.
- **Boundaries** (dependency-cruiser): a domain does not import the internals of another domain (only what that domain exports in its routes or use cases); `_shared/` does not import from any domain; `packages/domain` does not import Hono, Drizzle, React, `fetch` or anything from `apps/`; the web's data hooks do not use the DOM.
- **Names**:

| What | Convention | Example |
|---|---|---|
| Files and folders | `kebab-case` | `invite-member.ts`, `member-drawer.tsx` |
| Tests ([ADR-0029](0029-testing-strategy.md)) | same name + suffix | `invite-member.test.ts`, `routes.int.test.ts` |
| React components | `PascalCase`, file in kebab | `MemberDrawer` in `member-drawer.tsx` |
| Hooks | `use` + camelCase | `useMembers` |
| Functions and variables | `camelCase`; verb for actions | `inviteMember()`, `pendingInvitations` |
| Booleans | `is` / `has` / `can` | `isOwner`, `hasSeatsLeft`, `canInvite` |
| Types | `PascalCase`, no `I` prefix | `Invitation`, `InviteMemberInput` |
| Zod schemas | camelCase + `Schema`; the type is inferred | `inviteMemberSchema` → `z.infer<…>` |
| Constants | `UPPER_SNAKE_CASE` | `INVITATION_TTL_DAYS` |
| Exports | always named; no `export default` | `export function inviteMember…` |
| Internal packages | `@workampo/…` | `@workampo/db`, `@workampo/ui` |
| Tables and columns | plural, `snake_case` | `invitations`, `tenant_id`, `expires_at` |
| IDs | UUIDv7 with no prefix; branded type in TypeScript | `CompanyId`, `UserId` |
| Migrations ([ADR-0033](0033-expand-contract-migrations.md), [ADR-0044](0044-migrations-reference-data-seeds-and-backfills.md)) | number + verb + object | `0007_create_invitations.sql` |
| API routes | plural, kebab-case | `POST /api/t/:slug/invitations/:id/resend` |
| Error codes | `domain.reason` | `companies.invitation_expired` |
| i18n keys ([ADR-0047](0047-i18n-from-the-start.md)) | `domain.screen.element` | `companies.members.invite_button` |
| Analytics events ([ADR-0038](0038-product-analytics.md)) | `object_action` | `member_invited` |
| Variables and bindings | `UPPER_SNAKE_CASE` | `DB_GLOBAL`, `SENTRY_DSN` |

  A rule is followed end to end with the same name: `docs/domains/companies.md` (`@id:companies-15-1`) → `accept-invitation.ts` → `accept-invitation.test.ts` (cites `companies-15-1`) → error `companies.invitation_expired` → text `companies.invitations.expired`.
- **Database**: tables in plural and `snake_case`; `tenant_id` on every company table ([ADR-0010](0010-shard-1-from-v1.md)); no soft delete except where the product offers undo or restore (see "States and deletion"). Also (2026-11-13 and 2026-11-14):
  - **Table names by the domain concept** (2026-11-14): if the relationship has a name in the glossary, use that one (`members`, `invitations`, `subscriptions`), never the names of the tables it joins (`company_users`). Only a technical link without its own name uses `<entity>_<entities>` (`company_tags`); a 1:1 extension uses `<entity>_<aspect>` in plural (`company_profiles`, `member_preferences`). A table name exists in only one database.
  - **Columns and types**:

| Topic | Rule |
|---|---|
| Primary key | `id` UUIDv7 with no prefix, generated by the app, when the row is requested by URL or API or referenced by other tables (`companies`, `users`, `members`, `invitations`); business uniqueness goes in a separate index. Composite key on 1:1 extensions and on links that are never requested on their own (`member_preferences (tenant_id, user_id)`, `company_profiles (tenant_id)`). In the shard the key is `id` alone, not `(tenant_id, id)` |
| References | `<entity>_id` in singular (`user_id`); the company is always `tenant_id`; between databases, only the ID and no foreign key ([ADR-0010](0010-shard-1-from-v1.md)) |
| Booleans | `is_` / `has_` (`is_active`) |
| Instants and dates | `_at` for instants (ISO text in UTC); `_on` for dates without time (`renews_on`) |
| `created_at` | On every table, in UTC. Set by the app, not by the database (date defaults differ between engines) |
| `updated_at`, `updated_by` | On tables that people edit; the first time they equal the creation. `updated_by` is the user or the staff person |
| Author | No generic `created_by` (it comes from `audit_events`). Only authors with a domain name where the product shows them: `invited_by`, `published_by`, `uploaded_by` |
| `status` | Only on tables with a lifecycle, with the domain's values (`draft` / `published`, `pending` / `accepted` / `expired`, `trialing` / `active` / `deleting`) and a `CHECK` |
| Enumerations | Text with a `CHECK` of allowed values, no magic numbers |
| JSON | Only if the structure is free-form (landing sections, [ADR-0004](0004-landings-rendered-in-the-worker.md)): text validated with Zod on read and write |
| Money | `amount_cents` (integer) + `currency` |
| Emails | Normalized lowercase column with a unique index |
| Nulls | `NOT NULL` by default; nullable only if empty means something (`accepted_at` of a pending invitation) |
| Lengths | Validated with Zod (SQLite does not limit them) |

  - **Indexes and uniqueness**: names `idx_<table>__<columns>` and `uq_<table>__<columns>`; every indexed reference column; on company tables the indexes start with `tenant_id`; uniqueness per company where it applies (`uq_members__tenant_id_user_id`).
  - **Concurrency**: `version` column (integer) on whatever is edited on screen (settings, public page…); the write carries `WHERE version = ?` and, if it updates nothing, the interface warns that someone else changed it. Whatever must be atomic goes in a single `batch()` ([ADR-0010](0010-shard-1-from-v1.md)).
  - **States and deletion** (2026-11-14): real delete by default, with its event in `audit_events`. Soft delete only where the product offers undo or restore (toast with "Undo", `patterns.md`), as a value of `status` itself (`archived` or `deleted`, with `deleted_at`): the repo filters those values by default, unique indexes are partial (`WHERE status <> 'deleted'`) and a Workflow really purges after N days ([ADR-0056](0056-async-work.md)). This avoids a forgotten filter showing deleted data, a deleted slug or email blocking its reuse, and a clash with the right to erasure ([ADR-0027](0027-legal-and-data-protection.md)).
  - **History (`audit_events`)** (2026-11-14): append-only table, never modified or deleted: `id`, `tenant_id`, `actor_id` (user or staff), `action` (`companies.member_role_changed`), `target_type`, `target_id`, `changes` (JSON with only the changed fields, before → after), `request_id`, `created_at`.
    - **Each database records its own changes in the same `batch()`** as the change, so they are atomic: access changes (members, invitations, billing, staff) in `DB_GLOBAL`; business changes in the shard. A company's history joins the two by `tenant_id`.
    - It is written from the repo with a helper that adds the event to the `batch()`; no triggers (they are not visible in the code and do not move well to Postgres).
    - Minimal personal data in `changes` (ids, not copied emails or names) and never secrets; retention is set by [ADR-0027](0027-legal-and-data-protection.md).
    - When: `updated_at` and `updated_by` from the first table (filling them in later is impossible); `audit_events` with the staff audit of [ADR-0050](0050-enter-as-staff-impersonation.md) and, for the company, with the first PRD that needs history (probably "Team").
  - **Queries**: always through the domain's repo; explicit columns, never `SELECT *`; every list has a maximum page size; no queries in a loop (N+1).
  - **Migrations**: one migration, one change; an applied one is never edited ([ADR-0033](0033-expand-contract-migrations.md), [ADR-0044](0044-migrations-reference-data-seeds-and-backfills.md)).
  - **What goes in each database** (2026-11-14). Rule: `DB_GLOBAL` holds what is needed **before** knowing which shard the company is in or **between** companies; the shard holds everything the company creates and uses inside its own space. Each table is declared in `schema/global.ts` or in `schema/shard.ts` ([ADR-0009](0009-catalog-flags-and-sessions-in-d1.md), [ADR-0010](0010-shard-1-from-v1.md)).

| `DB_GLOBAL` | Why |
|---|---|
| Users, sessions, one-time codes ([ADR-0007](0007-central-login.md)) | Identity is one even if the person is in several companies |
| Person preferences (language, theme, emails) and legal acceptances ([ADR-0027](0027-legal-and-data-protection.md)) | They belong to the person, not to a company |
| Company registry: id, slug, shard, status (active, trialing, being deleted), **name and logo** | Resolve the company from the URL before touching a shard ([ADR-0005](0005-dual-resolve-tenant.md)); the company selector and the backoffice lists do not open a shard per company. Name and logo live only here, with no copy in the shard |
| `members` (user, company, role, [ADR-0054](0054-roles-and-permissions.md)) and `invitations` | Access data: session, company and role are read from one database on every request; accepting an invitation is a single `batch()` |
| Billing: plan, Stripe customer and subscription, payment status ([ADR-0051](0051-stripe-checkout-and-customer-portal.md)) | Stripe webhooks arrive with no company context and are resolved by the customer id; the plan sets the limits (seats = members) |
| Plans and flags, staff (`staff_members`, [ADR-0054](0054-roles-and-permissions.md)), staff audit ([ADR-0050](0050-enter-as-staff-impersonation.md)), processed webhooks ([ADR-0051](0051-stripe-checkout-and-customer-portal.md)) | They belong to the system |

| Company shard | Examples |
|---|---|
| Company profile and settings | Tax data, time zone, default language: Settings › General except name, slug and logo |
| Public page ([ADR-0004](0004-landings-rendered-in-the-worker.md)) | Sections, texts, SEO and publication status; KV stores the generated HTML |
| Each member's settings in that company | Which notifications they want from that company (`tenant_id` + `user_id`, no foreign key to `users`, [ADR-0010](0010-shard-1-from-v1.md)) |
| Panel notifications | Each one belongs to a company |
| Async work ([ADR-0056](0056-async-work.md)) | `jobs`, `idempotency_keys` |
| Metadata of uploaded files (`files`; the files themselves in R2, [ADR-0062](0062-files.md)) | Documents, company images |
| Business data of the vertical | Everything the product builds on top of the base |
| Company audit (future) | What each member did |

  - **Why**: moving a company to another shard (or to the future Postgres shard, [ADR-0010](0010-shard-1-from-v1.md)) means copying its rows with their `tenant_id` and changing the registry pointer. `DB_GLOBAL` stays small, with tables that change little. Each request makes at most two queries: global (session, company, role and plan) and, if needed, the shard.
  - **Deleting a company** touches two databases without atomicity ([ADR-0027](0027-legal-and-data-protection.md)): 1) it is marked "being deleted" in the registry, which cuts access immediately; 2) a Workflow ([ADR-0056](0056-async-work.md)) deletes the shard data; 3) the global data is deleted. If something fails midway, the Workflow retries and the company stays without access.
  - **Names in Drizzle**: camelCase in TypeScript (`expiresAt`) and snake_case in the database (`expires_at`), with Drizzle's `casing: 'snake_case'` option; names are not written twice.
  - **D1 limits**: each query accepts a limited number of parameters (100 according to the documentation) and each `batch()` has a maximum size. Operations with long lists (inviting 50 emails, bulk deletes) are split by the repo internally.
  - **Text search**: case-insensitive through a normalized lowercase column, not with `COLLATE NOCASE` (it does not behave the same in Postgres); `LIKE` wildcards escaped (lesson from the previous project).
  - **Alphabetical order**: by the normalized column; language-aware ordering (accents, ñ) is done by the interface with `Intl`.
  - **Tests**: each integration test starts with a clean database and the migrations applied (isolated storage of `@cloudflare/vitest-plugin`), with data from the factories of [ADR-0029](0029-testing-strategy.md).
  - D1 read replicas stay out until an ADR justifies them ([ADR-0009](0009-catalog-flags-and-sessions-in-d1.md)).
- **Dates and money**: UTC in the database and the API (ISO 8601); money in integers (minor units) plus the currency; formatting only in the interface with `Intl` ([ADR-0047](0047-i18n-from-the-start.md)).
- **Errors**: typed domain errors (each domain's `errors.ts`), translated to HTTP in a single place (`_shared/http/problem-json.ts`) with *problem+json* format (RFC 9457) and a stable `code` that the interface translates.
- **Imports**: internal packages by name (`@workampo/…`); no barrel files that re-export everything; no cycles (dependency-cruiser).
- **Validation and types**: Zod only at the boundaries (API input, forms, environment variables); types inferred from Zod and Drizzle, never duplicated by hand.
- **Configuration**: bindings and variables typed and validated at startup (`env.ts`); no reading loose variables around the code.
  - Local secrets only in `.dev.vars` (ignored by git); `.dev.vars.example` is committed with the names and no values. Staging and production secrets with `wrangler secret` and in the GitHub Environments ([ADR-0013](0013-ci-cd-with-github-actions.md)).
  - Public configuration per environment in `vars` of `wrangler.jsonc`. No `.env.<environment>` files.
- **Styles**: only tokens (`packages/ui/styles/tokens.css`) and Tailwind classes from the scale; no arbitrary values (`text-[20px]`) outside `packages/ui`.
- **UI components: componentize as much as possible, in three levels** (2026-11-13):

| Level | Where | What | Rules |
|---|---|---|---|
| **Global** | `packages/ui` | Primitives (adapted shadcn: button, fields, dialog, drawer, table, badge, tooltip…) and generic composites (data table, detail drawer, confirmation with "DELETE", filter bar, saved views, page header, KPI, empty/error/loading states, command palette, shell and sidebar) | No business knowledge: data and texts by props, no fetching from the server; accessible; with component tests; documented in `docs/design/components.md`; grouped by family in folders that mirror its headings (`actions/`, `forms/`…) and imported per family, `@workampo/ui/forms` (the person, 2026-11-22) |
| **App-shared** | `apps/<app>/src/_shared/components/` | They know the app but not a domain: company selector, user menu, plan usage bar, staff banner | No logic of a specific domain |
| **Feature** | Inside its domain (`src/companies/members/member-drawer.tsx`) | They combine global components with the domain's data and rules | Thin: no styles of their own or repeated presentation |

  - **Promotion**: what is already in the design system is made global from day one. What is born in a feature stays in its domain until the **second real use**, and then moves up to `_shared/` or `packages/ui` in the same PR. Nothing is generalized with a single use.
  - **How it is detected**:
    1. **On reuse**: dependency-cruiser prevents a domain from importing another domain's components, and `packages/ui` imports from no app. The second use breaks `pnpm check` and forces promotion.
    2. **On copying instead of importing**: a duplicate code detector (jscpd) reviews the `.tsx` files in CI and warns in the PR (warning, not blocking, at the beginning).
    3. **Before creating**: in Specify the UI/UX designer names the catalog components the screen uses and flags the new patterns (`docs/design/README.md`); `AGENTS.md` requires searching `packages/ui` and `components.md` before creating one; `REVIEW.md` includes "new component similar to an existing one".
- **Logs**: structured (JSON) with request id and company id, no personal data; errors go to Sentry through its adapter ([ADR-0039](0039-operations-and-incidents.md)), which sends with `ctx.waitUntil` so events are not lost when the Worker responds before the send finishes.
- **Database portability** (for a possible Postgres shard, [ADR-0010](0010-shard-1-from-v1.md)):
  - A single point provides a company's database client (`_shared/tenancy/`); the `*-repo.ts` files receive it and never use the D1 binding directly.
  - Queries with the Drizzle builder; no SQLite-specific SQL in the repos (`strftime`, SQLite JSON functions, `ROWID`, `AUTOINCREMENT`). If something specific is needed, it stays isolated and commented in the repo that uses it.
  - Portable types: IDs generated by the app, ISO dates in UTC, money in integers, explicit booleans in the schema.
  - The two-engine layer is not built now: only what would make it expensive later is avoided.
- **Webhook registry**: each provider that sends webhooks (Stripe, [ADR-0051](0051-stripe-checkout-and-customer-portal.md)) has an event → handler registry in its adapter, with a test that checks each event is registered exactly once. Fixed order: verify the signature, validate the payload with Zod, check idempotency (processed IDs in `DB_GLOBAL`) and call the use case.
- **Comments**: in English and only for the why; they never repeat what the code says. Workarounds for free-plan limits carry the `paid-plan` mark ([ADR-0056](0056-async-work.md)).
- **External dependencies, concentrated in one place**:
  - **Provider services and libraries** (WorkOS, Stripe, Brevo, Sentry, analytics, Cloudflare APIs that are not the database): always behind **our own adapter per capability**, named for what it does and not for the provider (`_shared/auth/`, `_shared/payments/`, `_shared/email/`, `_shared/error-tracking/`). It exposes our own types, never the provider's, and has its fake version for tests. A version or provider change stays inside its adapter.
  - **Base frameworks** (Hono, React, Zod, Drizzle, router and frontend state libraries): used directly; they are the language of the code and wrapping them adds nothing. Exception: UI components are imported only from `packages/ui` (adapted shadcn, `docs/design/`), which acts as the adapter.
  - **Utilities** (dates, IDs, money, slugs): own helpers in `_shared/` on top of what the platform gives (`Intl`, `crypto`), no library unless needed.
  - **Enforced**: dependency-cruiser fixes, for each provider package, the only folder that may import it; importing it from anywhere else breaks `pnpm check`. Every new dependency is classified in the PR: provider (it is born with an adapter and a rule) or base (with a reason).
  - Adapters live in `apps/<app>/src/_shared/<capability>/` while a single app uses them; if several need them (e.g. the backoffice, [ADR-0048](0048-separate-backoffice-worker-and-account-limits.md)), they move to `packages/integrations/`.
- **Decided later**, with the first PRD that uses it: router, server state and forms of the frontend (when the SPA is set up); pagination, filters and ordering of the API (with the first list); use of feature flags in code (with the first real flag, [ADR-0009](0009-catalog-flags-and-sessions-in-d1.md)).

## Consequences

See Decision.
