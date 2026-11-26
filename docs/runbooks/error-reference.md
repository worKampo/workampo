# Runbook: error reference

Find the event behind a reference that a person gives support («Referencia: 7F3K-92QD» on the 500 page). Decisions: [ADR-0039](../adr/0039-operations-and-incidents.md), [ADR-0053](../adr/0053-code-conventions.md), [ADR-0078](../adr/0078-api-urls-contracts-and-behaviour.md) §6 and §8.3.

The reference is random, one per unexpected error the API answers with a 500, in the format `XXXX-XXXX` (Crockford base32: no `I`, `L`, `O` or `U`). Read `0` for `O` and `1` for `I` or `L` if the person dictates it. A 4xx never has one. A 500 page without a reference was a failure in the browser (render, network or code load) or an unexpected 4xx. That does not rule out a server event: the server may have failed and its response been lost on the way. Search Sentry by the approximate time and what the person was doing.

## Sentry

Project `node-cloudflare-workers`, EU region ([platform](../platform.md#observability)). Search Issues or Discover with:

```text
reference:7F3K-92QD
```

The event shows the `release` (commit SHA), the `environment` and the stack. Its request URL has no query.

## Workers logs

The failure's log line is JSON: `{ "reference", "cfRay", "code", "companyId" }`. Workers logs are not stored (no `observability` in `wrangler.jsonc`), so only a live tail finds them; for a past failure, use Sentry. From `apps/api`, with the same token as in [rollback](rollback.md#command):

```sh
npx wrangler tail <app-stg|app> --search 7F3K-92QD
```

`cfRay` is the request id: search Cloudflare for it to see the rest of that request.

## What a reference does not do

- It does not prove who the person is. Anyone who sees the page, or is told the value, can quote it. Never give account data, company data or event details back because someone has a reference; act only on what the person can already see signed in.
- No endpoint resolves it: it is only a search key in Sentry and the logs.

## Never ask the person for

- Passwords, sign-in codes, session cookies or tokens.
- Screenshots of the browser's developer tools, request headers or the `cf-ray`.
- Personal data of other people.

Ask only for the reference, the approximate time and what they were doing. A real reference, `cf-ray` or Sentry event link never goes into issues, PRs or the repo ([ADR-0043](../adr/0043-public-repo.md)); describe the failure by its `code` and release.
