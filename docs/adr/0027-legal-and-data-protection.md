---
status: accepted
date: 2026-11-10
---

# ADR-0027: Legal and data protection

## Context

The legal texts are written or reviewed by a lawyer. This decision settles where they live, how they are versioned and what the system does.

## Decision

- **Pages** (`apps/marketing`, `/legal/*` and `/es/legal/*`, markdown with version and date, changes only by PR): legal notice (LSSI), privacy, terms, cookies, DPA (we are the data processor) and the list of sub-processors. In `en` and `es`, both reviewed by the lawyer; acceptance records the version **and the language**.
- **Acceptance recorded** in `DB_GLOBAL` per version; a relevant change asks for it again. The checkbox is never pre-checked.
- **Cookies**: technical only ([ADR-0008](0008-own-session-in-d1-host-only-cookie.md)), no banner. Nothing that sets non-technical cookies is loaded without prior consent (analytics is cookieless, [ADR-0038](0038-product-analytics.md)).
- **Sub-processors and data location**: those of [ADR-0063](0063-eu-data-residency.md), with their location and the safeguards for transfers, in the privacy policy.
- **Erasure** (§31): immediate block + purge, including KV, the R2 files ([ADR-0062](0062-files.md)) and analytics. Backups are deleted when their retention expires. A company is deleted in the order of [ADR-0053](0053-code-conventions.md): a mark in the global registry, a Workflow that empties the shard and, at the end, what is in global.
- **Access and portability**: export on request from the backoffice in v1; self-service later.
- **Retention** defined for sessions, logs, backups and companies that have been closed.
- **Company landings**: each company is the controller; the editor includes a footer with its legal links.
- **Internal documentation** (`docs/compliance/`): record of processing activities and of international transfers per sub-processor (DPF or standard contractual clauses).
- **Open**: EU data residency; if required, check what D1 offers before creating the production databases. **Decided later** in [ADR-0063](0063-eu-data-residency.md): D1 and R2 are created with EU jurisdiction from the start.

## Consequences

- Data residency in the EU is still open; if it is required, D1 must be checked before the production databases are created. Superseded on this point by [ADR-0063](0063-eu-data-residency.md).
- Self-service access and portability is deferred.

## More information

Related: [ADR-0063](0063-eu-data-residency.md).
