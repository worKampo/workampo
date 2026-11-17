---
status: accepted
date: 2026-11-10
---

# ADR-0032: Security reviewer

## Context

Security needs its own reviewer, with a fixed checklist and automatic checks in CI.

## Decision

- **Role** (`docs/agents/security-reviewer.md`). Always `max`.

| Moment | What it does | Deliverable |
|---|---|---|
| Specify (L and critical zones) | Light threat model: what can go wrong, who exploits it, what prevents it | Security section in the issue, next to the intent: threat → control → verifiable example |
| Verify | Reviews the diff against that section and the fixed checklist | Matrix in the issue's "Work log" comment |

- **Fixed checklist** (it is the security pass of `REVIEW.md`, [ADR-0015](0015-agent-context-multi-tool.md)): authorization and isolation (IDOR, the suite of [ADR-0029](0029-testing-strategy.md) green); **XSS in landings** (JSX escapes by default, rich text sanitized, `dangerouslySetInnerHTML` forbidden without a sanitizer, strict CSP); CSRF (`SameSite=Lax` + `Origin`); open redirect (`return_to`); injection (only parameterized Drizzle queries); session (expiry, revocation, rotation on sign-in); webhook signature; secrets out of code, logs and errors; headers (CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`); no personal data in logs, Sentry, telemetry or analytics.
- **Mandatory, cannot be skipped**: critical zones and any company-written content that gets rendered. Elsewhere, suggested.
- **Automatic in CI** (critical findings break CI): CodeQL ([ADR-0058](0058-agent-and-repo-tooling.md)), gitleaks (pre-commit and CI), `pnpm audit`, Renovate for versions and Dependabot security alerts (§41, [ADR-0058](0058-agent-and-repo-tooling.md)), headers integration test.

## Consequences

- **Deferred** (before opening to real customers): external pentest, `security.txt`, periodic audit.

## More information

Resolves §42 of the original spec.
