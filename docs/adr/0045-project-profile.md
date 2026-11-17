---
status: accepted
date: 2026-11-10
---

# ADR-0045: Project profile (`project.yaml`)

## Context

Agents and people need one place with the data to find their way around the project.

## Decision

`project.yaml` at the repo root with the data to get oriented: name, repo, board, key documents, the project's GitHub account and organization (the ones `pnpm work` requires of `gh` and git; see the [bootstrap](../process/bootstrap.md)), the Cloudflare Account ID and subdomain and, **per environment** (`local`, `stg`, `prod`), URL, Worker and Cloudflare dashboard, D1 and KV bindings, GitHub Environment, Sentry, monitor, WorkOS, Stripe mode and Brevo account (one per environment, [ADR-0014](0014-buying-a-domain-is-a-config-change.md)); the domain's public email addresses when it exists ([ADR-0014](0014-buying-a-domain-is-a-config-change.md)); list of services (what they are used for and where they are administered) and of secrets (name and where they live).

- `AGENTS.md` links it in its first section; people read it the same way.
- **Rules**:
  - Never secrets: only their name and where they live. Public repo ([ADR-0043](0043-public-repo.md)): no emails or personal data; people, by role.
  - No duplicated configuration: what lives in `wrangler.jsonc` (D1/KV IDs) is named and referenced, not copied.
  - Updated in the same PR that changes the infrastructure or adds a service (Document step, [ADR-0020](0020-ticket-lifecycle.md)); the spec reviewer checks it.
  - `pnpm check` validates its structure with a Zod schema (three environments, URL per environment, nothing shaped like a secret).
- It is created by ticket 4 of the "Working foundation" PRD and ticket 3 fills in the real data.

## Consequences

See Decision.
