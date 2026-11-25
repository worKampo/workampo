---
status: accepted
date: 2026-11-25
related: [6, 8, 19, 48, 50, 51, 53, 54, 56, 57, 59, 62, 72, 73, 77]
---

# ADR-0078: API URLs, contracts and behaviour

## Context

The only rules were "plural, kebab-case" ([ADR-0053](0053-code-conventions.md)), the `/api/t/:slug/*` space ([ADR-0006](0006-same-origin-route-map.md)) and the minimal URL rules of ticket 90 (2026-11-25). Agents picked different shapes for the same need (`/api/company-slugs/:slug` against `/api/companies/availability`). Spike #164 compared Zalando's RESTful API Guidelines, Google's AIPs, Microsoft's REST API Guidelines (Azure and Graph), RFC 9110, RFC 9457 and Stripe's API; the comparison per topic is in the spike's issue. These rules start from what the guides share; each deviation says why in one line. One first-party web client today, a mobile app later ([ADR-0057](0057-ready-for-a-mobile-app.md)).

## Decision

Decided by the person on 2026-11-25 (spike #164): numbered pages by default, with `page` and `pageSize` in the web and the API alike and cursors kept for very large tables; `version` and 409 for concurrent edits; 404 for what the caller cannot see and 403 for what they see but may not do; the caller's companies at `GET /api/companies`.

### 1. URLs

1. Inside a company, only `/api/t/:slug/<collection>…`, behind `requireSession` then `requireMember` (ADR-0006).
2. Outside a company, `/api/<collection>…`; never `/api/companies/:x/…` on the app Worker, which would open a second space beside `/api/t/:slug`.
3. Segments are lowercase kebab-case nouns; collections are plural (`invitations`, `permission-changes`).
4. Path parameters are camelCase: `:id` for the item of the collection just before it, `:<singular>Id` for a parent (`:unitId`). Query parameters are camelCase too, like the JSON fields they name (`?unitId=…&pageSize=50`); only path segments are kebab-case (the person, 2026-11-25).
5. Nest only a child that exists only inside one parent, with at most two ids after `/api/t/:slug`. A child of two parents is a flat collection filtered by query (`/assignments?memberId=…&unitId=…`).
6. Singletons have no id: `/api/me`, `/api/sessions/current`, `/api/t/:slug/settings`, `/api/t/:slug/logo`. They have no create or list (Google AIP-156): GET and PATCH, and PUT for a binary one (rule 2.4).
7. Two item aliases: `me`, the caller's own item (`/api/t/:slug/members/me`), and `current`, the caller's session. An alias takes the methods of the item it stands for (`DELETE /api/t/:slug/members/me` leaves the company).
8. A list answers only what the caller may see: `GET /api/companies` lists the caller's companies; the backoffice lists every company on its own Worker.
9. The path identifies; the query filters, searches, sorts and pages. The target's identifier never goes in the query, except the value a collection operation checks (`/companies/availability?slug=`).
10. The backoffice is its own Worker and host ([ADR-0048](0048-separate-backoffice-worker-and-account-limits.md)) with its own `/api/…`; staff address a company by id there (`/api/companies/:id`). Rule 2 applies to the app Worker only.
11. Browser-navigation flows (OAuth start and callback) and inbound webhooks (`/api/webhooks/<provider>`) are listed exceptions of the check.

### 2. Methods and actions

1. GET reads and has no side effects; the OAuth callback is the exception.
2. POST to a collection creates and returns 201 with the resource.
3. PATCH updates part of a resource with merge semantics: an absent field is unchanged, `null` clears it.
4. PUT only replaces a whole binary singleton (`PUT /api/t/:slug/logo`); no PUT on JSON resources (Google AIP-134, Microsoft Graph).
5. DELETE removes or deactivates and returns 204, or 202 when it starts a Workflow.
6. A plain field edit is PATCH. A state change with its own rule, permission, audit entry or conflict is an action: `POST …/:id/<verb>` as the last segment (`/units/:id/move`, `/invitations/:id/resend`). Deviation from Zalando, which forbids verbs: Google, Microsoft and Stripe allow them, and a verb keeps the rule, the permission and the log in one use case.
7. Action names are kebab-case verbs (`resend`, `move`, `deactivate`, `enable-writes`); an action that returns nothing answers 204.

### 3. Status codes

1. 200 for a read, an update or an action with a body; 201 created; 202 accepted (async work, or an email sent); 204 no body.
2. 400 for invalid input, malformed JSON or a missing `Idempotency-Key`.
3. 401 without a valid session.
4. 404 for anything the caller cannot see: another company, a unit outside their branches, a missing item. The same body in every case ([ADR-0054](0054-roles-and-permissions.md), [ADR-0072](0072-organization-units-and-scoped-roles.md)).
5. 403 `<domain>.forbidden` when the caller sees the resource but their role, or a read-only staff session, does not allow the action. Deviation from Google, which answers 403 even when the resource does not exist: Microsoft and RFC 9110 allow 404 to hide existence, and a seen resource needs the reason.
6. 409 for a conflict with the current state: a taken slug, the last owner, a stale `version`, the same idempotency key still in flight.
7. 413 for a body over the limit; 415 for an upload of a type that is not allowed.
8. 422 only for an `Idempotency-Key` reused with another body (the IETF idempotency draft). Deviation from RFC 9457's example: Zalando, Google and Microsoft use 400 for validation.
9. 429 always with `Retry-After` in seconds (RFC 6585).
10. 502 when a provider fails, 503 for maintenance. Any other 5xx is a bug and goes to Sentry.
11. Each domain declares the status of every error code once, in its `errors.ts` map (ADR-0053).

### 4. Bodies

1. JSON only (`application/json`), except uploads, with camelCase fields (Microsoft, Google JSON). Deviation from Zalando's and Stripe's snake_case: TypeScript end to end.
2. The top level is always an object; one resource is returned unwrapped.
3. Every field of a response type is always present: "none" is `null`, empty is `[]`. Deviation from Microsoft's "omit null": the `hc` types and an old mobile app read one fixed shape.
4. A response is built field by field from the logic's result, never from a raw row, so no hidden column leaks (OWASP API3).
5. Ids are UUIDv7 strings without a prefix (ADR-0053); a reference is `<entity>Id`.
6. Instants are `…At` in ISO-8601 UTC as `toISOString()` writes them; civil dates are `…On` as `YYYY-MM-DD` ([ADR-0077](0077-database-engines-behind-the-repos.md)). A company's time zone is an IANA name.
7. Money is `amountCents` (an integer) with `currency` (ISO 4217) (ADR-0053).
8. Enum values are lowercase snake_case strings; clients treat an unknown value as "other".
9. Requests are strict objects: an unknown field is a 400 (Microsoft; OWASP API3). Clients ignore unknown response fields, so adding one never breaks them.
10. The API returns no translated text: clients translate error codes. `Accept-Language` only picks the language of an email sent in that request when the person has no stored language ([ADR-0047](0047-i18n-from-the-start.md)).

### 5. Lists

1. Every GET on a collection pages from its first version: adding pages later breaks clients (Google AIP-158).
2. **Numbered pages by default** (the person, 2026-11-25): `?page=&pageSize=`, `page` from 1, `pageSize` 50 by default and at most 100 (more is capped, not refused), and the answer `{ items, total }`. The web's own URL uses the same names (`/c/northwind/members?page=2&pageSize=50`), so one name goes end to end (ADR-0053); only the repo turns them into the engine's `offset = (page - 1) × pageSize`. It feeds the numbered pager of the design system ("Showing 1–6 of 6"). Deviation from the guides that page by offset with `limit` and `offset` (Microsoft `top` and `skip`): no screen asks for an arbitrary row, and one vocabulary from the URL to the repo is worth more. `pageSize`, not `size`, so it never meets a filter on a field called `size`.
3. **Cursor for a very large table**, chosen per endpoint with a dated Update of this ADR: `?pageSize=&cursor=` and the answer `{ items, nextCursor }`, `nextCursor` a string or `null`, opaque and never built by the client, with no total. Zalando, Google and Stripe use it because it stays fast on large tables and does not skip or repeat rows when rows are added or removed. It only holds if the sort key never changes: a cursor list sorts by immutable fields (`createdAt` and `id`), so a row cannot move behind the cursor. A cursor list has no page numbers: the web's URL carries the opaque `cursor` (`?pageSize=50&cursor=…`), and a shared link whose cursor no longer works opens the first page.
4. Filters are plain query fields named like the response field (`?status=active&unitId=…`); `q` is the free-text search over the normalised column (ADR-0053).
5. `sort=field` or `sort=-field`, only on allowlisted fields, with a stable default order and `id` as the tie-breaker.
6. No filter expression language (Google AIP-160) until a real need.

### 6. Errors

1. Every 4xx and 5xx under `/api` is `application/problem+json` (RFC 9457) with `type: "about:blank"`, `title` (the HTTP reason phrase), `status` and `code` (`domain.reason`). Unknown paths, malformed JSON and body-limit errors included.
2. Invalid input with field detail adds `errors: [{ pointer: "/email", code: "access.invalid_email" }]` (RFC 9457 §3).
3. No `detail` meant for people, no stack traces and no personal data in an error.
4. Error codes are part of the contract: renaming or removing one is a breaking change.

### 7. Authentication and authorization at the edge

1. Order by kind of route, then input validation, then logic:
   - a public route (rule 3): no session;
   - a global route (`/api/me`, `GET /api/companies`, `POST /api/companies`): the session;
   - a company route (`/api/t/:slug/…`): the session, then company and membership, then permission (`can`).
2. The session is the `__Host-` cookie today; the mobile app adds `Authorization: Bearer` in the same middleware ([ADR-0008](0008-own-session-in-d1-host-only-cookie.md), ADR-0057).
3. Every `/api` route needs a session except a listed set of public ones (sign-in, OAuth, webhooks, the invitation preview).
4. Writes accept only JSON, multipart, or the raw body of a binary singleton with its image type (`PUT /api/t/:slug/logo`, rule 9.4), so a foreign page cannot write without a preflight; `csrf()` checks the Origin on POST.
5. "Enter as" uses the same `/api/t/:slug` routes with a session marked as impersonated. A write in a read-only staff session is a 403 `access.read_only_session`, and `GET /api/me` shows the impersonation ([ADR-0050](0050-enter-as-staff-impersonation.md)).

### 8. Headers

1. `Idempotency-Key` (a UUID) is required on every POST that creates a resource or starts a job; a retry returns the stored result ([ADR-0056](0056-async-work.md)). Sign-in is exempt: a retry fails on the used code anyway.
2. Every `/api` response carries `Cache-Control: no-store` (personal data) and `X-Content-Type-Options: nosniff`. Files follow [ADR-0062](0062-files.md). No CORS: same origin (ADR-0006), and native apps need none.
3. The request id is Cloudflare's `cf-ray`. Logs carry it with the company id, never emails, names, IPs or tokens (ADR-0053).
4. The client version headers stay as [ADR-0059](0059-web-client-version.md) sets them. Deviation from Microsoft's "no `x-` prefix": they exist and are internal.

### 9. Concurrency, bulk, long work, files, webhooks

1. **`version` and 409** (the person, 2026-11-25): what is edited on screen carries `version` in its response; PATCH sends it back, and a mismatch is 409 `<domain>.stale_version` (ADR-0053). Deviation from `ETag` / `If-Match` / 412: one field in the typed body instead of a header, as Google's `etag` field.
2. Bulk is POST to the collection with `{ items: [...] }`, all or nothing, at most 50 items so the work fits D1's limits; it answers 201 `{ items }`, and an invalid item is a 400 with its pointer (`/items/3/email`). No 207.
3. Long work answers 202 with `Location: /api/t/:slug/jobs/:id` and the job, which shows `status` (`queued`, `running`, `succeeded`, `failed`), `progress` and `errorCode`; a running job answers with `Retry-After` (ADR-0056).
4. Uploads: an image is a `PUT` of the raw body to a binary singleton, a document a multipart `POST /api/t/:slug/files`. The type is checked by its magic bytes, at most 10 MB, else 413 (ADR-0062).
5. Inbound webhooks: `POST /api/webhooks/<provider>`. Signature first, then the payload schema, then idempotency by event id, then the use case; answer 2xx fast and do heavy work in a Workflow ([ADR-0051](0051-stripe-checkout-and-customer-portal.md), ADR-0053).
6. Outbound webhooks (Post-MVP) need their own ADR, following Standard Webhooks.

### 10. Limits

1. A JSON body is at most 100 KB, else 413; uploads per rule 9.4.
2. Every endpoint runs a bounded number of queries, never one per item, within one invocation's CPU and D1 budget; what does not fit is a Workflow (ADR-0056).

### 11. Evolution

1. No version in the URL, a header or the media type: the API only adds new fields, endpoints, optional parameters and enum values ([ADR-0019](0019-typed-contract-with-hono-rpc.md), ADR-0057). Deviation from Google's and Graph's `/v1`: every client is first-party, and old mobile versions are held up by additive change and a minimum client version.
2. A breaking need is a new field or endpoint beside the old one. The old one carries `Deprecation` (RFC 9745), later `Sunset` (RFC 8594) with `Link: <…>; rel="deprecation"`, and goes only when the minimum supported client no longer calls it.
3. A new required request field, a narrowed type, or a renamed field or code is breaking.

### 12. Contract and checks

1. The contract is the `hc` type `AppType` (ADR-0019); OpenAPI only for an external consumer.
2. A test over `app.routes` checks the rules marked "check" in [code conventions](../process/code-conventions.md#api-urls-and-contracts-adr-0078); the rest is the reviewer's list in [review](../process/review.md). Today the test checks the shape of the paths only (kebab-case segments, parameter names, the tenant prefix or a collection, no `/api/companies/:x` and no `:slug` outside a company); the rows marked "check (#172)" wait for issue 172, and until then they are reviewed by hand.

## Consequences

- One shape per need: an agent derives the URL, the method, the status and the body from the table in code conventions.
- Today's paths stay. The gaps become one MVP task: malformed JSON and unknown `/api` paths answer as plain text, the problem body has no `title`, 429 has no `Retry-After`, responses have no `Cache-Control: no-store` or `nosniff`, and there is no body limit.
- Pages, PATCH with `version`, bulk, jobs and webhooks are built with the first endpoint that needs each.
- `RateLimit` headers wait for their RFC; they would also publish the thresholds that `AGENTS.md` keeps out of the repo.
- Accepting this ADR resolves "pagination, filters and ordering of the API", which ADR-0053 left for later.

## More information

Guides compared on 2026-11-25:
- Zalando RESTful API Guidelines
- Google AIP 121–136, 155, 156, 158, 160, 185, 193 and 211
- Microsoft REST API Guidelines (Azure, Graph)
- RFC 9110, 6585, 9457, 9745 and 8594
- the IETF drafts for `Idempotency-Key` and `RateLimit` headers
- Stripe's API (pagination, idempotency, errors, versioning)
- Standard Webhooks 1.0
- OWASP API Security Top 10 (2023)

The comparison table is in issue 164.

## Updates

- 2026-11-25 (issue 171): the gaps named in Consequences are closed: problem+json with `title` for malformed JSON, unknown `/api` paths and bodies over 100 KB, `Retry-After` on 429, and `no-store` and `nosniff` on every `/api` response.
- 2026-11-25 (issue 172): the test over `app.routes` in `apps/api/src/index.int.test.ts` now asserts every row marked "check" in code conventions: methods, path shape and depth, parameter names with listed exceptions, 401 without a session, 404 to a non-member under `/api/t/:slug`, `no-store` and `nosniff`, `Idempotency-Key` on creating POSTs and the allowed error statuses; the "check (#172)" marks of rule 12.2 are now plain "check".
