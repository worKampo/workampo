---
status: accepted
date: 2026-11-14
---

# ADR-0019: Typed contract with Hono RPC

## Context

API and SPA need end-to-end types without generating code. An installed mobile app keeps calling with its old version ([ADR-0057](0057-ready-for-a-mobile-app.md)), so the API cannot change freely.

## Decision

- Hono `hc` client: end-to-end types between API and SPA without generating code.
- OpenAPI (`@hono/zod-openapi`) when there are external consumers.
- **The API only evolves by adding** (2026-11-14): removing or changing the meaning of a field or endpoint requires a transition period, because an installed mobile app will keep calling with its old version ([ADR-0057](0057-ready-for-a-mobile-app.md)). Long work: `202` + `GET /api/t/:slug/jobs/:id`; `Idempotency-Key` on the `POST`s that create something ([ADR-0056](0056-async-work.md)). Version headers `X-Client-Version`, `X-App-Version` and, only in emergencies, `X-Min-Client-Version` ([ADR-0059](0059-web-client-version.md)).

## Consequences

See Decision.
