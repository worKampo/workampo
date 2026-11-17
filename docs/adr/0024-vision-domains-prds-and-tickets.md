---
status: accepted
date: 2026-11-10
---

# ADR-0024: Vision, domains, PRDs and tickets

## Context

The project needs a fixed vocabulary for its product documents and work items, and a place for each of them. GitHub does not define "PRD" or "ticket"; they are this project's own words over issues and sub-issues.

## Decision

- **Concepts** (defined in `GLOSSARY.md`):

| Concept | Lifetime | In GitHub | In the repo |
|---|---|---|---|
| **Vision** | Living | — | `docs/product/vision.md`: vision, language, global non-functional requirements, roadmap |
| **Domain** | Permanent | Label `area:<domain>` | `docs/domains/<domain>.md`: **living spec** |
| **PRD** | Temporary (weeks); closed when its outcome is met | Parent issue, `type:prd`: the PRD is its body | — |
| **Ticket** | One branch, one PR, one commit | Sub-issue (or standalone); intent in its body | No folder: its **change spec** is the diff of the living spec in the PR |
| **Task** | Hours | Checkbox in the ticket's issue | Row of `tasks.md` (temporary on the branch) |

- "PRD" and "ticket" are our own vocabulary over issues and sub-issues; GitHub does not define them.
- **Initial domains** (with a living spec): `access`, `companies`, `billing`, `public-site`. **Support labels** (no living spec, they only filter the board): `platform`, `content`, `backoffice`. Split and ownership rule in [ADR-0052](0052-living-specs-only-and-flow-by-size.md).
- **Origin and parent of each ticket type**:

| Type | Where it comes from | Parent PRD? |
|---|---|---|
| `feature` | Slicing | Always |
| `chore`, `spike` | Slicing or standalone | Only if it comes from slicing |
| `bug` | Tests, staging, production or users | If its PRD is still open; otherwise a standalone issue |

- **The `area:` label is mandatory on every ticket**, with or without a PRD: a domain says which living spec to update; a support label only filters the board.
```
docs/product/vision.md
docs/domains/                  ← living specs (permanent), one per domain
  access.md
  companies.md
  billing.md
  public-site.md
docs/platform.md             ← environments, pipelines, backups, alerts (operations)
docs/learnings.md            ← learnings (D52)
```
- PRDs and tickets have no folder: they live in their issues. `plan.md`, `tasks.md` and `PROGRESS.md` are temporary files of the branch ([ADR-0016](0016-procedure-harness.md)).
- Branches use the issue number without leading zeros (`feature/15-invite-by-email`).
- **Two kinds of spec**: **living spec** (`docs/domains/<domain>.md`, the current behavior, always up to date) and **change spec** (the diff of the living spec in the ticket's PR, with `@wip(#n)` rules: what changed; the why is in the issue; frozen from its approval, [ADR-0020](0020-ticket-lifecycle.md)).
- **Documentation rule** (Tasks step, [ADR-0020](0020-ticket-lifecycle.md)): every ticket that changes or clarifies current behavior updates the living spec of its domains **in the same PR**. The spec reviewer checks it. It also applies in S.

## Consequences

See Decision.

## More information

Related: [ADR-0052](0052-living-specs-only-and-flow-by-size.md), [ADR-0016](0016-procedure-harness.md), [ADR-0020](0020-ticket-lifecycle.md).
