PRD #10 · Ticket #93 · Branch: feature/93-paginas-de-sistema-404-y-500-con

Scope: Intent, E1–E5, the Security table (R1–R6, A1, X1–X2, W1–W2, D1) and the UI section with decisions 1–8 of the issue, all decided by the person on 2026-11-26. Nothing here reopens them.

## Seams and sharing

- **Provider touched: Sentry** (`apps/api/src/_shared/error-tracking/sentry-error-tracking.ts`, `@sentry/hono/cloudflare`). One new export, `tagErrorReference(reference)`, which sets the `reference` tag on the request's isolation scope (`getIsolationScope().setTag`). `apiOnError` calls it; the Sentry middleware captures `c.error` after `next()`, so the tag is already on the scope when the event is built. `dataCollection` stays as is (`urlQueryParams: false`). No new fake adapter: the test sets a test DSN on `sentry.test` in the bindings and spies on `fetch` to that host to read the envelope (no real DSN, ADR-0043).
- **Reference generator** (API only, it uses `crypto.getRandomValues`, so it is not pure): `apps/api/src/_shared/crypto/error-reference.ts`, `newErrorReference()`: 5 random bytes = 40 bits → 8 Crockford base32 characters (`0123456789ABCDEFGHJKMNPQRSTVWXYZ`), as `XXXX-XXXX`. Nothing else goes in (no time, colo, counter, ids, path, hashes: R1). Beside `random-token.ts`.
- **Pure rule to `packages/domain`**: the format, `ERROR_REFERENCE = /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/` and `isErrorReference(value: unknown)`, in `packages/domain/src/_shared/api-errors.ts` (errors of the HTTP layer, owned by no domain), re-exported from `src/errors.ts`, so the existing `@workampo/domain/errors` export covers it: no `package.json` changes.
- **`packages/app-core`**: `ApiError` gets an optional `reference` (`readonly reference: string | undefined`). `send()` reads the body once for `code` and `reference`. It keeps the reference only when `status >= 500` and `isErrorReference(body.reference)`; anything else (a 4xx, markup, a wrong shape) is dropped (X1, decision 2). A network failure (`status: 0`) has none (decision 3).
- **`packages/ui`** (texts as props, like `AppLoader`'s `label`; no i18n in ui):
  - `SystemPage` (layout family, `layout/system-page.tsx`): the `CardScreen` layout (chrome background at full height, the colour logo in the header, the 384 px card), no logo inside the card (decision 7). Props: `title`, `body`, `code` (the meta line), optional `reference` slot, `actions`. On mount the h1 gets focus (`tabIndex={-1}`). `CardScreen` gets one optional prop so its h1 can take that focus (default off, existing screens unchanged). Actions stack at full width.
  - `ErrorReference` (feedback family, `feedback/error-reference.tsx`): «Referencia: X» in `<code dir="ltr" translate="no">` with `user-select: all` and `break-all`. A copy button with an inline SVG icon (no icon library; like Banner) inside `Tooltip`, using `navigator.clipboard.writeText`. Copied: for 2 s a check icon in `--pos`, tooltip «Copiada», a hidden `role="status"` says «Referencia copiada», focus stays on the button. Failure: the reference is selected (`Range` over the `<code>`) and a `role="alert"` line appears. Props: `reference` plus its five texts. No animation (reduced motion is satisfied by having none).
  - Button: a new variant `subtle` (decision 8): transparent with a transparent 1 px border; on hover the secondary's border (`--border-hard`, text `--text`); on `pointer-coarse` always a soft border (`--border`). The copy button is the small icon-only square (32 px) and 44 px on `pointer-coarse` (decision 8, E5).
- **`packages/i18n`**: `common.json` › `system_pages` in es, en, ca and `_context` (the table of the issue; ca needs native review). `common` is already loaded by `initI18n` before the first render, so the texts are there when the router fails (no lazy namespace). `companies.json` loses `not_found.*` and `company_error.*` in all four (decision 4) in the web task, when nothing uses them any more. `companies.errors.not_found` stays: it is the error key of the API code.
- **`apps/web`**:
  - `apps/web/src/_shared/system-pages/`: `NotFoundPage` and `ErrorPage` built on `SystemPage`. Fixed `document.title` through `useDocumentTitle` (`Página no encontrada · worKampo`, `Algo ha ido mal · worKampo`). «Ir al inicio» is a router `<Link to="/">` styled `secondary`, a fixed route (X2). «Reintentar» calls `window.location.reload()`. `ErrorPage` shows `ErrorReference` only when the error is an `ApiError` with a `reference`; it never renders `error.message` or the stack (W1). Nothing from the path, query or slug is rendered (X1).
  - `root-route.tsx` imports both eagerly and sets `errorComponent` and `notFoundComponent` on `rootRoute` (no `lazy()`, so a failed chunk load still paints the 500).
  - `workspace.route.ts`: the company route's lazy part drops `errorComponent` and `notFoundComponent`; the loader still throws `notFound()` on `companies:errors.not_found`, which bubbles up to the root's `notFoundComponent`, and any other error bubbles to the root's `errorComponent`. `company-error/` is deleted and `CompanyNotFoundPage` is removed from `company-home.page.tsx`. `CompanyPageNotFoundPage` (a missing page inside one's own company, inside the shell) stays.
- **Living specs and examples** (docs/procedures/living-specs.md): `platform` is not a domain (ADR-0052; docs/domains/README.md). Default, see open question 1:
  - E2 → `companies-90-12` in `docs/domains/companies.md`, reworded under `@wip(#93)` (decision 4). The `companies-91-6` scenario changes only its expected text.
  - E1, E3 (web part), E5 → examples of the new `SystemPage` and `ErrorReference` sections in `docs/design/components.md` (E-numbered, no `@id`), as components do (ticket 126).
  - E3 (API part) and E4 → the API contract: ADR-0078 §6 Update, tested in `api-behaviour.test.ts` and `index.int.test.ts` citing R3–R6.
  - A browser check of E1, E3 and E5 (the eager root pages, the mobile viewport, X1 and X2 payload URLs) in `apps/web/e2e/system-pages.e2e.ts`, outside `acceptance/` (like `apps/api/e2e/health.e2e.ts`), since it cites no `@id`. The 500 is reached with `page.route` answering `/api/me` with a 500 problem+json carrying a made-up valid reference.

## Data model

No change.

## API contracts

- **500 under `/api`** (`apiOnError`, any error that is not an `HTTPException` nor a domain `ProblemError`): `application/problem+json`, exactly `{ type: "about:blank", title: "Internal Server Error", status: 500, code: "api.unexpected", reference: "XXXX-XXXX" }` (R3). No `detail`, message, stack or path. `problemJson` gets an optional `reference` that it adds only when given.
- **500 outside `/api`**: stays `text/plain` `Internal Server Error` with no reference in the body (W2); the reference is still generated, logged and tagged.
- **Every 4xx** (including the 404 of `requireMember` and `api.not_found`): unchanged, never a reference (decision 2, A1).
- **Headers** (R4): `no-store`, `nosniff` and `application/problem+json` already come from `apiResponseHeaders`, which runs after the route, so the 500 keeps them; the test proves it.
- **One reference per failed request** (R6): `apiOnError` calls `newErrorReference()` once, stores it with `c.set('errorReference', …)` (new optional variable in `AppEnv`), and uses that one value in the body, the log and the Sentry tag.
- **Log** (R5): `console.error(JSON.stringify({ reference, cfRay, code, companyId }))` in place of `console.error(error)`, so the error's message (which may hold personal data) never reaches Workers logs; Sentry keeps the stack. `cfRay` is the `cf-ray` header only when it matches Cloudflare's shape (hex, a dash, the colo letters), otherwise `null`, like `clientVersionLog`. `companyId` is `c.var.company?.tenantId` when the request passed `requireMember`, otherwise `null`. No URL, query, slug, email or IP.
- **No endpoint takes a reference** (R2): nothing to build; the test designer's route test over `app.routes` asserts no parameter is named like it.
- `/__debug/error` (D1): no change; `ENABLE_DEBUG_ERROR` is only under `env.stg` in `wrangler.jsonc`, and this ticket does not touch that file.

## Migrations

None.

## Flags

None.

## Analytics events

None.

## Risks

- **A1 / isolation**: the web 404 of a foreign company must be byte-identical to a missing one and must not show the slug. The company route no longer has its own not-found page, so this relies on `notFound()` from the company loader reaching the root's `notFoundComponent`. If TanStack Router renders nothing there, throw `notFound({ routeId: rootRouteId })` instead. The API side does not change (`findActiveMembership` stays the only query); the existing `companies-90-12` integration test keeps proving it. The web task runs at `max`.
- **Sentry tag ordering**: the tag must be set before the SDK builds the event from `c.error`. If the envelope shows no tag, capture explicitly in `apiOnError` with `captureException(error, { tags: { reference } })` and keep the middleware from capturing twice (`shouldHandleError`). The envelope may be sent through `waitUntil`: the test uses `exports.default.fetch` (it has an execution context) and waits for the spied `fetch`.
- **Test DSN and fakes**: the DSN in tests is `https://public@sentry.test/1`, and the references in tests are made up (ADR-0043 "No entra"). Emails only on allowed test domains.
- **5xx retries in the web**: `shouldRetry` retries a 5xx three times, so the 500 page appears after the retries and shows the reference of the last attempt; each attempt has its own reference in the logs. This is acceptable and not changed here.
- **Domain 5xx**: today the only 5xx domain code is `access.google_failed` (502), which reaches the person as a redirect, never as problem+json. A future domain 5xx answered through `toProblem` would carry no reference; ADR-0078's Update says the reference comes with every 5xx built by `apiOnError`.
- **First wave and types**: the tests import modules that do not exist yet (`error-reference.ts`, `system-page.tsx`, `error-reference.tsx`). The test designer imports them through a namespace import or a dynamic import so that typecheck still passes with `it.fails`, as in ticket 179.
- **D59 reload-once is not built here**: a failed chunk load goes straight to the root's 500 with no reference (decision 3). The "reload once" step of `patterns.md` › New version available stays for its own ticket.
- **Parallel wave 2**: five tasks with disjoint paths and no `package.json` or lockfile change in the whole ticket. The orchestrator commits them one at a time with `git add -A <Touches>`.
- **Open questions** (only real ones):
  1. **Where do E1, E3, E4 and E5 live?** `platform` has no living spec, and README says a rule never goes to a support label. Default above: E2 in `companies-90-12`; E1, E3 (web) and E5 as `SystemPage` and `ErrorReference` examples in `components.md`; E3 (API) and E4 in ADR-0078 §6 and its tests; a browser check outside `acceptance/`. The other option is to put E1, E3 and E4 in `companies.md` or `access.md`, which does not fit the ownership rule. The test designer needs the answer before T1.
