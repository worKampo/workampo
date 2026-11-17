---
status: accepted
date: 2026-11-10
---

# ADR-0036: Language and glossary

## Context

The project needs one language policy and one shared vocabulary, with one term per concept.

## Decision

- **Language policy**: in the [vision](../product/vision.md). Summary: the whole technical base in English (code, schema, routes, files, branches, labels, commits, PR titles, tests, `AGENTS.md`, agents, procedures, runbooks, ADRs); processes, PRDs and specs may be in Spanish; UI, emails, help, changelog and legal are multilingual, with `en` by default and `es` ([ADR-0047](0047-i18n-from-the-start.md)).
- **`GLOSSARY.md`**, one term per concept:
  - **Product**: company, user, membership, role, staff, tenant (= company in code), slug, landing.
  - **Process**: vision, domain, support label, PRD, hypothesis, outcome review, ticket, ticket size (S/M/L), task, wave, living spec, change spec (the diff of the living spec in the PR), `@wip` / `@issue` / `@id`, moment (the three moments of [ADR-0020](0020-ticket-lifecycle.md)), mandatory stop, verification package, protected acceptance scenario, walking skeleton, learning, Definition of Ready / Done.
  - **Delivery**: PR, CI, staging, release, rollback, revert, hotfix, bugfix, feature flag, expand/contract, observation window.
  - **Operations**: SLO, SEV, incident, postmortem, runbook, DORA.
  - Each term comes with its GitHub equivalent when it has one.

## Consequences

See Decision.
