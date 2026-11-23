---
status: accepted
date: 2026-11-14
---

# ADR-0063: EU data residency

## Context

Several of these options are chosen when the resource or the account is created and cannot be changed afterwards.

## Decision

**Decision** (2026-11-14): everything that stores data lives in the EU from day one, on staging and production alike.

| Service | What it stores | Decision |
|---|---|---|
| D1 | Users, companies, business data | `wrangler d1 create --jurisdiction eu`: runs and stores only in the EU. Cannot be changed after creation |
| R2 ([ADR-0062](0062-files.md)) | Files | `wrangler r2 bucket create --jurisdiction eu` |
| Sentry | Errors and traces | Organization in the EU region (Frankfurt), same price on all plans; chosen at creation and not changed. Some account metadata may remain in the US |
| PostHog (if chosen, [ADR-0038](0038-product-analytics.md)) | Events without personal data | Its EU cloud (verify at sign-up) |
| WorkOS | Email and name ([ADR-0008](0008-own-session-in-d1-host-only-cookie.md)) | ⚠ No official documentation found on an EU region: confirm with WorkOS before "Access and first company". If there is none, what they receive is already minimal (companies, roles and sessions are in our database) and it is covered by their data processing agreement and the EU standard clauses; the `_shared/auth/` adapter ([ADR-0053](0053-code-conventions.md)) allows changing provider if a customer demands more |
| Brevo | Recipients' emails | European company |
| Stripe | Payment data (never passes through us, [ADR-0051](0051-stripe-checkout-and-customer-portal.md)) | Its European subsidiary |

- **What cannot be limited to the EU on the free plan**, with its rule:
  - **KV** is replicated worldwide: never personal data (only the public HTML of the landings).
  - **Workers and Workflows** process in the data center closest to the user (limiting it to the EU is an Enterprise plan feature): Workflow parameters carry only ids, never personal data.
  - **Logs and Sentry**: no personal data in events (ids, not emails), with Sentry data scrubbing enabled.
- **Privacy policy ([ADR-0027](0027-legal-and-data-protection.md))**: list of subprocessors (Cloudflare, WorkOS, Stripe, Brevo, Sentry and, if chosen, PostHog) with their location and the safeguards for international transfers.
- **Who checks it**: the provisioning script always creates D1 and R2 with `--jurisdiction eu` and fails without it; the security review ([ADR-0032](0032-security-reviewer.md)) checks that nothing personal goes to KV, to Workflow parameters or to logs.

## Consequences

- D1 jurisdiction and the Sentry region cannot be changed after creation.
- Workers and Workflows cannot be limited to the EU on the free plan; this is covered by the rules above.
- Pending check: confirm with WorkOS whether an EU region exists, before "Access and first company". PostHog EU cloud to verify at sign-up.

- **2026-11-17**: verified against the current Cloudflare docs: KV supports an EU jurisdiction for durable storage (the cache can be anywhere). `landings-*` are created with `--jurisdiction eu`. The rule "never personal data in KV" stays.

## Updates

- 2026-11-23 (the person, ticket 132): `apps/api/src/_shared/auth/` is now `_shared/identity/` (the identity provider seam and its adapters); the session code moved to `apps/api/src/access/session/` and `access/require-session.ts`. `VerifiedIdentity`, `IdentityProviderKey` and `chooseProvider` moved to `packages/domain/src/_shared/`.
