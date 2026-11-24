---
status: accepted
date: 2026-11-10
---

# ADR-0009: Catalog, flags and sessions only in D1

## Context

The original spec contradicted itself on where the catalog, flags and sessions live (D1 vs KV).

## Decision

- **Decision**: `DB_GLOBAL` is the only source of truth for the company catalog, feature flags and sessions.
- **Consistency in v1**: no read replicas; without `withSession`, all queries go to the primary and what was just written is always read back.
- Read replicas + Sessions API are still in public beta; they will be enabled as an optimization, with their own ADR, when latency justifies it.
- KV only stores the rendered HTML of the landings.

## Consequences

Read replicas are deferred until latency justifies them, with their own ADR.

## More information

Resolves the contradiction between §2.4 (D1) and §6/§8 (KV) of the original spec.

## Updates

- 2026-11-24 (the person, ticket 112): `DB_GLOBAL` stays the only source of truth for the catalog, flags and sessions; its engine may change later as [ADR-0077](0077-database-engines-behind-the-repos.md) describes (D1 today).
