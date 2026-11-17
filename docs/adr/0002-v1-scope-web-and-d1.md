---
status: accepted
date: 2026-11-10
---

# ADR-0002: Scope of v1: web + D1

## Context

The spec describes several products at once. A dual SQLite + Postgres schema doubles the cost of every change.

## Decision

- **In scope**: Hono API, D1, web app, backoffice, auth with WorkOS, Stripe, company landings, corporate website, help, changelog and legal pages.
- **Deferred** (each with its own ADR when its time comes): mobile app and offline sync (the base is prepared for it from now on, [ADR-0057](0057-ready-for-a-mobile-app.md)), Postgres, Tinybird / AI / vector search, outbound webhooks, custom domains, rate limiting. Asynchronous work is designed now and built with its first real case ([ADR-0056](0056-async-work.md)).
- **Why**: the spec describes several products at once; a dual SQLite + Postgres schema doubles the cost of every change.

## Consequences

Everything listed under "Deferred" is out of v1 and needs its own ADR when it is picked up.

## More information

Resolves §5, §7, §8, §13, §32, §34, §39 of the original spec.
