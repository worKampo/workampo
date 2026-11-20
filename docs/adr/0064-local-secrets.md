---
status: accepted
date: 2026-11-14
---

# ADR-0064: Local secrets

## Context

Secrets need a single place to live and as few of them as possible on disk. This applies from ticket 1; the [multiple machines note](../notes/multiple-machines.md) will build on it.

## Decision

**Decision** (2026-11-14): a personal password manager as the only place for anything that must be stored, and the minimum possible number of secrets on disk. It applies from ticket 1; the [multiple machines note](../notes/multiple-machines.md) will build on it.

- **Manager**: free Bitwarden, personal account, with a "worKampo" folder. **Never a corporate manager**: it is administered by another organization, it is lost on leaving it and it mixes the project's data with others' ([ADR-0043](0043-public-repo.md), [bootstrap](../process/bootstrap.md)). Personal 1Password would be valid, but it costs about $3 per month.
  - Sign up with the **personal email, not the project's Gmail**: the manager stores that Gmail's password, and depending on each other for recovery would leave no way out if one is lost.
  - Long master password, memorized only; 2FA with an authenticator app; **Bitwarden recovery code printed and kept away from the computer**.
- **Each secret in its place**:

| Secret | Where it lives |
|---|---|
| Passwords, 2FA and recovery codes of the accounts | Manager |
| Private key of the agents' GitHub App | `%USERPROFILE%\.workampo\github-app.pem`, outside the repo and with permissions only for the Windows user; copy in the manager. A script uses it to obtain **1-hour installation tokens**, which are the ones the agents use; never a permanent token |
| Admin tokens (GitHub for rulesets, Cloudflare to create resources) | Nowhere: they are created with a one-day expiry, passed as an environment variable in that terminal, used and revoked. Scripts read them from the variable, fail without it and never print it |
| Deployment tokens per environment | GitHub Environments ([ADR-0041](0041-agent-boundaries.md)), pasted with `gh secret set --env stg` from standard input, with no intermediate file; in the manager, only their entry (permissions, expiry), without the value |
| WorkOS test users on staging | Secrets of the `stg` Environment ([ADR-0029](0029-testing-strategy.md)) |
| `.dev.vars` | Local, ignored by git, almost empty (login, Stripe and emails are fake locally) |
| SSH key | One per machine, with passphrase, in the SSH agent |

- **Agents do not read the App key**: "deny" rule in `.claude/settings.json` on `~/.workampo/**`. It is a configuration barrier (the agents use the same Windows user); if it leaked, the damage is bounded by the App's minimum permissions ([ADR-0041](0041-agent-boundaries.md)) and it is rotated.
- **Never a secret in the Claude chat, in an issue or in a commit** ([ADR-0041](0041-agent-boundaries.md), [ADR-0043](0043-public-repo.md)): if a command asks for a value, the person types it in the terminal. gitleaks and push protection are the safety net.
- **Rotation**: the App key, once a year or at any doubt; deployment tokens, with an expiry (e.g. 90 days) and a runbook to renew them.

## Consequences

- Ruled out: a corporate password manager; using the project's Gmail to sign up for the manager.
- The "deny" rule on `~/.workampo/**` is only a configuration barrier, since agents share the Windows user; the bound on damage is the App's minimum permissions plus rotation.

## Updates

- 2026-11-20: the key of a second, board-only GitHub App lives in CI as a repository secret, so workflows can move cards; the agents' App key stays on the person's machine ([ADR-0069](0069-board-app-in-ci.md)).
