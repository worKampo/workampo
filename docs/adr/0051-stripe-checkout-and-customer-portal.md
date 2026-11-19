---
status: accepted
date: 2026-11-10
---

# ADR-0051: Billing with Stripe Checkout and Customer Portal

## Context

The product charges companies for plans. Card data must never pass through our app, and plan state must be reliable.

## Decision

- **Card data never passes through our app**: sign-ups and plan changes with payment go through **Stripe Checkout** (page hosted by Stripe); payment method, invoices and the payer's tax details are managed in the **Stripe Customer Portal**. The app only shows state (plan, usage, last payment, linked invoices).
- **The plan changes when the signed Stripe webhook arrives** (`/api/webhooks/stripe`, signature verified, [ADR-0032](0032-security-reviewer.md)), never when the browser returns. The return page shows "confirming" until then and the company also receives an email.
- Webhooks are **idempotent** (processed event IDs are recorded in `DB_GLOBAL`) and tolerant of out-of-order events. They are implemented with the **webhook registry** of [ADR-0053](0053-code-conventions.md): signature first, payload validated with Zod, one handler per event.
- **Failed payment** (`past_due`): a strip across the whole app for owners and admins with "Update payment method" and a **grace period** before the limits of the lower plan are applied. Its length is set in the "Plans and billing" PRD (initial proposal: 14 days, aligned with Stripe's automatic retries).
- **Downgrade**: applied at the end of the paid period. If the lower plan admits fewer members, the company chooses who keeps access; the rest become read-only (nothing is deleted).
- **Upgrade**: immediate, with Stripe proration.
- `plan_level`, the plan's flags, the Stripe customer and subscription and the payment state live in `DB_GLOBAL` ([ADR-0009](0009-catalog-flags-and-sessions-in-d1.md), [ADR-0053](0053-code-conventions.md)): the webhook is resolved by the customer id without opening any shard. Only the webhook changes them.
- Stripe in **test mode** until launch (§37). Prices to be defined.
- Critical zone (billing, [ADR-0022](0022-model-and-effort-by-complexity.md), [ADR-0030](0030-test-designer.md), [ADR-0032](0032-security-reviewer.md)).

## Consequences

See Decision.

## More information

Resolves §37 of the original spec (Stripe in test mode until launch).
