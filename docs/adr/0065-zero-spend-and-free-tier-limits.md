---
status: accepted
date: 2026-11-12
---

# ADR-0065: Zero spend and free-tier limits

## Context

Preliminary stages should cost nothing until there are real customers. The free plans have limits that need to be known.

## Decision

- **Zero spend in the preliminary stages** (decided 2026-11-12): everything on free plans until there are real customers. No own domain (`*.workers.dev` URLs, [ADR-0011](0011-environments-without-extra-domain-cost.md) and [ADR-0014](0014-buying-a-domain-is-a-config-change.md)), free CodeRabbit ([ADR-0041](0041-agent-boundaries.md)), Workers/D1/KV Free, GitHub Free with a public repo ([ADR-0043](0043-public-repo.md)), Stripe in test mode ([ADR-0051](0051-stripe-checkout-and-customer-portal.md)). Any expense is an explicit decision with its reason.

- **Workers Free**: 100,000 requests/day and 10 ms of CPU per request. Enough for development and beta; production with real traffic will probably require Workers Paid ($5/month). It will be decided with data.
- **D1 Free**: 500 MB per database, 100k rows written/day. **KV Free**: 1,000 writes/day.
- **Rate limiting** (§32): GA binding, not confirmed on Free; deferred.
- **Queues**: ⚠ verify whether it is included in the free plan before using it ([ADR-0056](0056-async-work.md)).

## Consequences

- Production with real traffic will probably require Workers Paid ($5/month); to be decided with data.
- Rate limiting is deferred.
- Pending check: ⚠ verify whether Queues is included in the free plan before using it.
