---
status: accepted
date: 2026-11-14
---

# ADR-0059: Web client version

## Context

Each Worker version only serves its own static files (Cloudflare documentation, consulted on 2026-11-14). A user with the previous version open keeps running its JavaScript; the new API serves it ([ADR-0019](0019-typed-contract-with-hono-rpc.md)), but when it lazy-loads the code of another screen (`members-a1b2.js`) it gets a 404 and the screen breaks.

## Decision

**Decision** (2026-11-14): the SPA (app and backoffice) knows which version of the code it is running, detects when another one is deployed and updates without breaking or losing changes.

- **Which version the client compares: the hash of the SPA build**. The Worker identifies itself by the commit SHA ([ADR-0042](0042-traceability.md)), in `/health` and in Sentry. A deployment of `app` that does not change the SPA (e.g. only the corporate website or the help) reloads nobody; as only the affected Workers are deployed ([ADR-0060](0060-deploy-affected-workers-only.md)), a change in the backoffice does not either.

| Piece | Rule |
|---|---|
| Version in the build | The SPA carries the hash of its build (`import.meta.env.VITE_APP_VERSION`) and sends it on every call with `X-Client-Version`; logs, Sentry and analytics record it |
| Version in the API | Every response carries `X-App-Version` with the hash of the SPA build that this Worker serves: the client detects the new version without extra requests |
| Reload on navigation | Once a new version is detected, the next screen change is a full reload to the same URL |
| Unsaved changes | Never reload with the save bar visible (`patterns.md`); wait for the person to save or discard |
| File that fails to load | Error loading lazy code → a single reload (mark in `sessionStorage` to avoid a loop); if it fails again, error page with its reference |
| Tab open for a long time | Discreet banner "There is a new version · Reload" |
| Minimum version (emergency) | The API may respond with `X-Min-Client-Version`; an older client sees a blocking dialog: "Reload to continue". Only for a security flaw or a change that could not be purely additive ([ADR-0019](0019-typed-contract-with-hono-rpc.md)) |
| Cache | `index.html` without cache; hashed files `immutable`. No service worker |

- **How it fits**: database compatible with the previous version ([ADR-0033](0033-expand-contract-migrations.md)) → API that only adds ([ADR-0019](0019-typed-contract-with-hono-rpc.md)) → web client that updates within minutes (this ADR) → mobile app with minimum version and "update the app" screen ([ADR-0057](0057-ready-for-a-mobile-app.md)). Public Astro pages do not need it.
- **When**: the `X-Client-Version` logging, in ticket 3 of "Working foundation"; `X-App-Version` and the client part, when the SPA is set up (first PRD with UI), because before that there is no SPA build to compare.
- **Tests**: unit test of the logic that decides whether to reload; integration test that checks the API's version headers; E2E that simulates a new version and checks that the next navigation reloads without losing unsaved changes.

## Consequences

See Decision.

## Updates

- 2026-11-27 (issue 95): the client part is built. The version is the first 12 hex of SHA-256 over the git tree of the SPA inputs (`apps/web` and the workspace packages it reaches through `dependencies`), so the same files give the same hash, also after a revert. Each build also carries its date: the commit date of the last commit that touches those inputs, as UTC ISO. `X-Min-Client-Version` is that ISO date, because a hash has no order; it comes from `MIN_CLIENT_VERSION`, a plain variable in `env.stg.vars` and `env.prod.vars` of `apps/api/wrangler.jsonc`, so raising it goes through a PR and a deploy the person approves ([deploy runbook](../runbooks/deploy.md#raise-the-minimum-client-version)). The API never sends a minimum later than the build date it serves, and the deploy refuses one. The tab left open becomes 30 minutes after a new version is detected without navigating. The reload goes to the navigation's destination, always a path of the app. Two `sessionStorage` marks prevent loops: `workampo:version-reload` (the hashes already reloaded to) and `workampo:chunk-reload` (the build that already reloaded after a failed code load); after a second failed load the 500 shows without a reference line, as the browser's failure has no server event. The browser test for unsaved changes (E3) goes with the save-bar ticket; this one tests it with a test component. Pattern: [patterns.md](../design/patterns.md#new-version-available-d59).
