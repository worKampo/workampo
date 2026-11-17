---
status: accepted
date: 2026-11-13
---

# ADR-0017: Verifiable harness

## Context

A task, a wave and a ticket each need one objective definition of done that runs the same locally, in pre-commit and in CI. The repo also needs consistent hygiene rules from the start.

## Decision

- `pnpm check` (typecheck + lint + tests) is the only definition of done for a task or wave: local, pre-commit and CI. For a ticket, it is the Definition of Done ([ADR-0034](0034-prds-slicing-and-ticket-format.md)).
- Tests run inside workerd with local D1/KV: `@cloudflare/vitest-plugin` (formerly `vitest-pool-workers`), Vitest ≥ 4.1. Migrations in tests with `applyD1Migrations()`.
- Lint and format with **Biome**; architecture rules with **dependency-cruiser** (e.g. a route does not import D1 directly; `packages/*` does not import from `apps/*`).
- Git hooks with **lefthook**: `pnpm check` and gitleaks in pre-commit. The tests of the first wave go in as expected failures (`it.fails`) and acceptance scenarios do not run in pre-commit ([ADR-0020](0020-ticket-lifecycle.md), [ADR-0030](0030-test-designer.md)).
- **Repo hygiene** (2026-11-13):
  - **A single formatter**, Biome, mandatory across the whole repo (format checked in `pnpm check`).
  - **LF line endings**: `.gitattributes` with `* text=auto eol=lf` and `.editorconfig` (LF, UTF-8, 2-space indentation). Explicit exception, for this repo, to the person's general preference for CRLF: the code runs on Workers and Linux CI.
  - **Complete `.gitignore` from the start**: `node_modules/`, `*.tsbuildinfo`, `.turbo/`, `.wrangler/`, `dist/`, `.dev.vars*` except `.dev.vars.example`, `.env*` except `.env.example`, `playwright-report/`, `test-results/`, `coverage/`.
  - **Strict TypeScript**: `strict` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride` and `verbatimModuleSyntax` in the base `tsconfig`.
  - **Node version pinned** in `.nvmrc` and `engines`, and pnpm's in `packageManager`.

## Consequences

See Decision.
