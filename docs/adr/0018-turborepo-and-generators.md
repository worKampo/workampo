---
status: accepted
date: 2026-11-13
---

# ADR-0018: Turborepo and generators

## Context

The monorepo needs a task graph with caching and a way to implement the generators of the procedure catalog ([ADR-0016](0016-procedure-harness.md)).

## Decision

- `turbo run` for the task graph and the monorepo cache.
- `turbo gen` implements the generators of the catalog in [ADR-0016](0016-procedure-harness.md) (`docs:new`, `changelog:new`, `db:migration:new`, `test:new`, `e2e:new`).
- **Internal packages are consumed as source code** (2026-11-13): no package in the monorepo has its own build; their `exports` point to TypeScript and each app compiles them. So there is no need to build packages before testing or developing.

## Consequences

See Decision.
