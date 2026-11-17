---
status: accepted
date: 2026-11-10
---

# ADR-0028: Images in documentation

## Context

Documentation images need a home, a way to stay current and limits that keep the repo light.

## Decision

- In the repo, next to the guide that uses them, with a relative path; versioned in the same PR. Astro optimizes them (WebP/AVIF, responsive, lazy).
- **Generated screenshots**: `pnpm docs:screenshots` with Playwright and a fixed seed; highlights with injected CSS; light and dark variants if needed.
- **Rules in `pnpm check`**: `alt` is mandatory; about 500 KB maximum per source image; diagrams as code (Mermaid).

## Consequences

- **Deferred**: images in R2, videos and GIFs.
- **Ruled out**: Git LFS.
