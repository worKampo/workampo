---
status: accepted
date: 2026-11-10
---

# ADR-0004: Landings rendered in the Worker

## Context

`astro build` cannot run inside a Worker, and regexes over HTML are fragile.

## Decision

- **Decision**: sections are Hono JSX components. On save, the Worker renders the company's JSON to HTML and stores it in KV. Hidden sections are not emitted.
- **Why**: `astro build` cannot run inside a Worker; regexes over HTML are fragile.
- **Consistency**: KV propagates in 60 s or more. The editor shows the HTML that the API returns on save and never re-reads it from KV. Visitors may see the previous version during that time; this is accepted.
- **Limit**: KV Free allows 1,000 writes/day across the whole account (one per save). Enough for the beta.

## Consequences

Visitors may see the previous version of a landing for 60 s or more after a save (accepted). The KV Free limit of 1,000 writes/day applies to the whole account.

## More information

Resolves the contradiction between §4.2 (Astro build) and §4.5 (regex) of the original spec.
