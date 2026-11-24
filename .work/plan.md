PRD #10 · Ticket #150 · Branch: feature/150-e2e-con-lo-que-prueban-recorridos-de

No behaviour change: acceptance scenarios move with their ids and steps.

## What moves

- `apps/web/e2e/acceptance/`: `sign-in-screens.e2e.ts` (E1, E16, E17, the staging smoke E18), `sign-in-code.e2e.ts` (E1–E3), `google-sign-in.e2e.ts` (E6, E7).
- Stays in `apps/api/e2e/`: `session.e2e.ts` (E13–E15), `rate-limits.e2e.ts` (E4, E5), `linking.e2e.ts` (E8–E12), `health.e2e.ts`, and `support.ts`, which the web's scenarios import.

## Setup

- `apps/web/playwright.config.ts` starts the API Worker (migrations, seed, `wrangler dev`) on port 8789 with its own local state, or targets `E2E_BASE_URL`; `@workampo/web#e2e` builds the web first.
- `deploy.yml` runs the staging smoke (`@smoke`) from the web's suite. `e2e.yml` keeps installing Chromium once: both suites use the same Playwright version.

## Order of commits

The Playwright config is code and knip rejects the scenarios without it, so the move comes after code with the person's `/reopen-acceptance` (comment 7131276134) in its `Reopen:` trailer (ADR-0030).

## Risks

- The staging smoke not found after deploy: covered by the `deploy.yml` change; checked locally with both suites (8 and 11 tests).

## Security

The smoke step keeps its env (`E2E_BASE_URL`, `WORKOS_API_KEY` from the stg environment) and only changes the package filter.
