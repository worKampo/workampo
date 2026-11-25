---
status: accepted
date: 2026-11-24
related: [19, 53, 57]
---

# ADR-0075: API layout with entry, logic and data apart

## Context

The Update of 2026-11-23 to [ADR-0053](0053-code-conventions.md) gave each API endpoint a folder with a `-route.ts` and its use case, and left repos wherever their feature was. The person could not tell at a glance where an endpoint enters, where its logic is and where data is accessed, and asked for that separation without global layers (`controllers/`, `services/`, `repositories/`).

## Decision

Endpoints stay vertical and data goes horizontal (the person, 2026-11-24):

- Each endpoint's folder holds `<endpoint>.route.ts` (the entry: validate, call the logic, answer), `<endpoint>.logic.ts` (always, however short) and its tests, all named after the endpoint. Lists of routes are `<domain>.routes.ts` and `<feature>.routes.ts`.
- Data access is one `<table>.repo.ts` per table in `<domain>/data/`, only Drizzle; a repo may also hold an atomic write across the domain's tables. A domain reads only its own tables.
- The role goes after a dot, as in `.test.ts`.
- dependency-cruiser enforces it: an entry imports no repo, logic imports no Hono, only repos and `_shared/db/` touch Drizzle.

This replaces the hyphenated `-route.ts`, `-routes.ts` and `-repo.ts` names of the API in ADR-0053's Update of 2026-11-23; the rest of that Update stands. Details in [code conventions](../process/code-conventions.md#api-routing-the-person-2026-11-23).

## Consequences

- A change to an endpoint stays in its folder, and every query of a table is in one file.
- Every endpoint has a logic file, even a two-line one: no exception to remember.
- The web and `packages/app-core` follow the same idea in issue 146.

## Updates

- 2026-11-24 (the person, ticket 146): the suffix says the type of what is inside, always in the singular, so the lists of routes are `<name>.router.ts` (`access.router.ts`, `sign-in.router.ts`); `<endpoint>.route.ts` stays one endpoint. Every file that uses a provider names it, even when it is the only one: the repos are `<table>.d1.repo.ts`, and Cloudflare's own reads live in `cloudflare-request-origin.ts` and `cloudflare-version.ts`.
- 2026-11-24 (the person, ticket 148): the unit is the use case, in business language, and the endpoint is the technical term for the HTTP route its `.route.ts` exposes. Read `<endpoint>` above as `<use-case>`: `<use-case>/<use-case>.route.ts`, `<use-case>.logic.ts`; a flow with two endpoints is two use cases. `requireSession` lives in `access/require-session.middleware.ts`.
- 2026-11-25 (the person, ticket 179): a domain's repos live in `<domain>/_repo/`, no longer `<domain>/data/` ([ADR-0053](0053-code-conventions.md), Updates).
