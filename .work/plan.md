PRD #10 · Ticket #91 · Branch: feature/91-elegir-empresa-al-entrar-y-cambiar-de

Decisions of the person (2026-11-25) on the open questions are marked **(decided)**. Security controls come from the issue's Security section.

## Seams and sharing

- No new provider. Identity (Google) is unchanged: `returnTo` travels in our own state cookie, never to the provider.
- `packages/domain` (pure, unit-tested, exported entries):
  - `access/sign-in/return-to.ts`: `safeReturnTo(value: unknown): string | undefined`. Accepts only a string that starts with `/`, not `//` or `/\`; with no `\`, no control characters or whitespace, no `%2f`, `%5c`, `%0`, `%1` (any case); at most 1024 characters; whose `new URL(value, base).origin` stays the base; and that does not start with `/api/` or `/login` **(decided: no loops, no landing on JSON)**. Anything else is `undefined` (E8). Used by the web's `/login` search and by the API's google-start and google-callback.
  - `companies/selection/entry-destination.ts`: `entryDestination({ items, total })` → `create` (total 0), `company` with `items[0].url` (total 1), else `choose`. Only `/` uses it: code sign-in and Google both go to `returnTo ?? '/'`, so the rule is written once.
- `apps/api` (critical: `access/**`, `companies/data/member.d1.repo.ts`):
  - `companies/selection/selection.router.ts` mounted in `companies.router.ts` → `list-my-companies/list-my-companies.{route,logic}.ts` + `.int.test.ts`.
  - `_shared/pagination/page-query.ts` (`_shared/http/` already holds 8 code files): the ADR-0078 page schema (first list endpoint): `page` integer ≥ 1 (default 1), `pageSize` integer ≥ 1 (default 50, capped at 100, not refused); anything else 400 `companies.invalid_request`.
  - `member.d1.repo.ts`: `listActiveCompanies`, sharing one `activeMembership(userId)` condition with `findActiveMembership`, so the list and `requireMember` cannot drift.
  - `access/sign-in/google-state.cookie.ts`, `google-start.route.ts`, `google-callback.route.ts`. **(decided)** The cookie stays unsigned: `__Host-`, HttpOnly, Secure, SameSite=Lax, single use, 10 minutes; the callback checks `returnTo` again before redirecting.
- `packages/app-core`:
  - `companies/data/companies.api.ts`: `listMyCompanies(client, { page, pageSize })`; `query-keys.ts`: `['companies', 'mine', page, pageSize]`.
  - `companies/selection/list-my-companies/list-my-companies.hook.ts`: `myCompaniesQueryOptions(client)` with `pageSize: 100` (`shortcut: one page of 100 companies, page the picker if someone has more`), `useMyCompanies`.
  - `companies/selection/company-picker/company-picker.hook.ts`: `useCompanyPicker(language)` sorts the page with `Intl.Collator(language)` **(decided: the SQL orders by the raw name; only beyond 100 companies could it differ)**.
  - `create-company.hook.ts` invalidates `['companies', 'mine']`; `replaceSession` already drops the list on sign-in and sign-out.
- `apps/web`:
  - `companies/selection/selection.route.ts`: `/companies`, with the session guard; the loader fetches the list; a 401 clears the session and redirects to `/login`.
  - `companies/selection/company-picker/company-picker.page.tsx`: «Has entrado como {email}», the sign-out button, the list (company `Avatar` of i#126 **(decided)**, name and `/c/<slug>`, each a link to its `url`), «Crear una empresa nueva». No role, no sidebar subtitle **(decided)**. Names only as JSX text.
  - `companies/workspace/`: a guarded catch-all `/c/$slug/$` that shows the company's not-found state **(decided)**, so E6/E7's `/c/northwind/settings` and any future subpage run the session guard.
  - `access/home/home.route.ts`: no page; `beforeLoad` — no session → `/login` (E11); with a session, `fetchQuery(myCompaniesQueryOptions)` then `entryDestination`: `create` → `/companies/new`, `choose` → `/companies`, `company` → its `url`. Delete `home.page.tsx`.
  - `_shared/router/in-app-path.ts`: `inAppPath(url)` → the pathname when same origin, else `undefined` (then `location.assign`); replaces the inline logic in `new-company-form.tsx`.
  - Move `access/session/sign-out-button.tsx` and its test to `_shared/components/` (used by two domains, conventions rule 5).
  - `access/sign-in/sign-in.route.ts`: `validateSearch` → `{ error?, returnTo? }`, `returnTo` only through `safeReturnTo` **(decided: `returnTo`, camelCase, ADR-0078; ADR-0007's `return_to` is the same thing)**. `HistoryState` gains `signInReturnTo?`.
  - `login.page.tsx`: state `{ signInEmail, signInReturnTo }`; the Google link is `/api/sessions/google?returnTo=<encoded>` when there is one. `code.page.tsx` reads it; `code-form.tsx` goes to `returnTo` or `/`; «Usar otro email» keeps `search: { returnTo }`.
  - The guards of `/c/$slug`, `/c/$slug/$`, `/companies` and `/companies/new` redirect to `/login` with `returnTo: location.href` (path and search); the workspace loader's 401 does the same.
  - `new-company-form.tsx`: «Volver a mis empresas» `<Link to="/companies">` replaces «Cancelar» (E5) **(decided)**; with 0 companies `/companies` shows the empty list and «Crear una empresa nueva», never a redirect.
- `packages/i18n` (es, en, ca, `_context`): `companies.company_picker.{title, signed_in_as, create}`, `new_company.back_to_companies` replaces `new_company.cancel`; `common.sign_out` moved from `access.home.sign_out`; delete `access.home.*`.
- Living specs: E1–E11 into `docs/domains/companies.md` (picker, destination) and `docs/domains/access.md` (`returnTo`).

## Data model

- No schema change. The list starts from `members` by `user_id` (`idx_members__user_id`), `status = 'active'`, joins `companies` on its key with `status IN ('active', 'trialing')`, orders by `companies.name, companies.id`, `LIMIT pageSize OFFSET (page - 1) × pageSize`. `total` is a `count()` with the same condition, in the same `batch`.
- Seed: `global/0002-companies.sql` adds `clinica-norte` «Clínica Norte» (active, shard-1), an active membership of user …001 (then in northwind, sol-bakery and clinica-norte, E2), a suspended membership of user …003 in sol-bakery (E9), and the contact; `shard/0001-companies.sql` adds its root, owner and profile. Users …004 and …005 keep 0 companies (E3); user …002 keeps one (E1).

## API contracts

- `GET /api/companies?page=&pageSize=` (global route, `requireSession`): 200 `{ items: [{ name, slug, url }], total }`, built field by field, `url` from `tenantUrl`, no role; 400 `companies.invalid_request`; 401. Passes the route check unchanged.
- `GET /api/sessions/google?returnTo=` (listed exception): `safeReturnTo`; an invalid value is dropped, never a 400. The cookie value is `state` or `state.<returnTo>` (the state is base64url, never a `.`); `takeStateCookie` splits at the first `.`.
- `GET /api/sessions/google/callback`: on success 302 to `safeReturnTo(returnTo) ?? '/'`, checked again on read; errors still go to `/login?error=<code>`.
- `POST /api/sessions` (code): unchanged; the web keeps `returnTo`.

## Migrations

None.

## Flags

None.

## Analytics events

None.

## Risks

- **Open redirect**: one pure rule at every entry and again before the redirect; unit table (`//x`, `/\x`, `\/x`, `/\t/x`, `/%2F%2Fx`, `/%5Cx`, `https://…`, `javascript:`, `data:`, `http:/x`, empty, non-string, 1025 characters, `/api/x`, `/login`); API int test of the round trip and of a tampered cookie ending at `/`.
- **List drifting from access**: one shared condition; int test with a suspended membership, a `deleting` company and another user's company, and `total` equal to the visible rows (E9); A/B sessions, `?userId=` ignored, item keys exactly `name`, `slug`, `url`.
- **State cookie format**: without `returnTo` the value is the bare state, so existing callback tests stay valid.
- **Loops**: `/` never redirects to itself; `/companies` never redirects on 0; `/companies/new` does not apply the destination rule; `returnTo` refuses `/login` and `/api/`.
- **E2E to update in this PR**: companies-90-13 now ends at `/login?returnTo=…`; access-96-2 and access-96-6 land on `/companies/new`; `create-company.e2e.ts` `openForm` lands directly on `/companies/new`.
- **Subdomain mode**: `inAppPath` keeps only same-origin URLs in the router; the one-time code exchange stays Post-MVP.
- **Stale list after creating**: `/` uses `fetchQuery`; creation invalidates the list.
