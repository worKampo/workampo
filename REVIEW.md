# Review policy

Applied by the spec reviewer, the security reviewer and the AI review in CI (CodeRabbit reads this file through [`.coderabbit.yaml`](.coderabbit.yaml)). Why: [ADR-0015](docs/adr/0015-agent-context-multi-tool.md).

Findings neither approve nor block: the person approves. One exception: a finding from the "No entra" list is a failure that must be resolved before the PR moves on.

## Passes

Review the diff against the issue it refers to (`Ticket #N` in the PR body).

| Pass                 | Look for                                                                                                                                                                                                                                                                                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bugs                 | Logic errors, unhandled errors, missing edge cases, races (a write that must be atomic and is not in one `batch()`), wrong tenant scoping, N+1 queries, `SELECT *`, unbounded lists                                                                                                                                                                   |
| Security             | The checklist below                                                                                                                                                                                                                                                                                                                                   |
| Compliance           | The diff does what the issue's intent and its approved examples say, nothing more. Every approved example has a test that cites its `@id`. Behavior without an approved example is a finding                                                                                                                                                          |
| Living spec and plan | When the diff touches `docs/domains/*.md` (and `plan.md`, if the ticket has one): rules and examples match the code, tags follow the [traceability](docs/procedures/traceability.md) formats, no rule is duplicated across domains, terms match [`GLOSSARY.md`](GLOSSARY.md)                                                                          |
| UI/UX                | Only if the diff touches the interface. Against [ADR-0031](docs/adr/0031-ui-ux-designer.md) and [`docs/design/`](docs/design/README.md): tokens and scale classes only, states (empty, loading, error), accessibility, copy, i18n keys instead of literals. Flag a new component similar to an existing one in `packages/ui` or `_shared/components/` |

### Security checklist

From [ADR-0032](docs/adr/0032-security-reviewer.md). Mandatory in critical zones and for company-written content that gets rendered; elsewhere, apply what the diff touches.

- Authorization and isolation: IDOR; every company query carries `tenant_id`; the isolation suite stays green.
- XSS in landings: JSX escaping, rich text sanitized, no `dangerouslySetInnerHTML` without a sanitizer, strict CSP.
- CSRF: `SameSite=Lax` plus `Origin` check.
- Open redirect: `return_to` validated.
- Injection: only parameterized Drizzle queries.
- Session: expiry, revocation, rotation on sign-in.
- Webhooks: signature verified before anything else.
- Secrets out of code, logs and errors.
- Headers: CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`.
- No personal data in logs, Sentry, telemetry or analytics.

## Important and Nit

| Level     | What                                                                                                                                                                                                                                                                                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Important | A "No entra" item; a security checklist miss; a bug that loses or leaks data or breaks a rule of the living spec; behavior contradicting the issue's intent or an approved example; a missing test for an approved example; a boundary broken (domain internals, `packages/domain` impurity) that `pnpm check` did not catch; a traceability check that fails |
| Nit       | Naming, wording, formatting, minor simplifications, style preferences, anything `pnpm check` already enforces                                                                                                                                                                                                                                                 |

Label each finding `Important` or `Nit`. Report Nits in one short list at the end; never repeat what Biome, dependency-cruiser or CI already report.

## Ignore

- Files generated by tools (`apps/*/worker-configuration.d.ts`, `pnpm-lock.yaml`) and exported artifacts. `docs/diseno.html` is hand-written: review it like any other doc.
- Pre-existing issues the diff does not touch.

## Traceability checks

Verify by hand until CI does them; formats and the pending checks live in [traceability](docs/procedures/traceability.md#ci-checks). At minimum: branch name, `Refs:` trailer in every commit, `Ticket #N` and labels in the PR body, no `Closes #n`, no `@wip` / `PROGRESS.md` / `plan.md` / `tasks.md` reaching `master`, author with the project's noreply email, `size:` label (`size:L` if critical-zone paths change), every example's `@id` cited by a test.

## No entra

The repo is public ([ADR-0043](docs/adr/0043-public-repo.md)). None of this enters code, `docs/`, issues, PRs or commit messages. Check the diff and the PR text; a hit is a failure, not a Nit.

| Does not enter                                                                                                                                  | Where it goes                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Secrets, tokens, keys, `.dev.vars`                                                                                                              | Cloudflare secrets and Environment secrets                                                                 |
| Personal data of customers or users, real emails, names of people                                                                               | Sentry and the database; people by role                                                                    |
| Business strategy: unpublished prices, margins, real or potential customers, business metrics, commercial agreements, unannounced product plans | Private repo `worKampo/business`                                                                           |
| Code of the vertical product with its own competitive value (sector rules, calculations, partner integrations)                                  | Activates the trigger below                                                                                |
| Unpatched vulnerabilities and exploitable details of security incidents                                                                         | Private vulnerability reporting and private security advisories; after the fix, a public summary if useful |
| Exact anti-abuse thresholds (request limits, Turnstile)                                                                                         | Environment variables, not constants in code                                                               |
| Source maps published with the web                                                                                                              | Uploaded only to Sentry; a `.map` file in the deployment is a failure                                      |

May be present: identifiers that give no access (Cloudflare Account ID, names of Workers and bindings). Emails other than the seed test domain (`*.test`, `example.com`) and the project's noreply are a failure.

Trigger to go private: the first paying customer, or the first vertical code with its own competitive value. A diff that introduces such code must say so ("this ticket introduces vertical code with its own value: ADR-0043"); the person decides by ADR between all-private with GitHub Team and a public base plus a private vertical repo.
