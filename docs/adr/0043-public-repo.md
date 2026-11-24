---
status: accepted
date: 2026-11-14
---

# ADR-0043: Public repo

## Context

Why (verified on 2026-11-10 in the GitHub documentation):

| Feature | Private, free | Public, free | Private with Pro or Team ($4/user/month) |
|---|---|---|---|
| Branch protection / rulesets | ❌ | ✅ | ✅ |
| Secrets per Environment | ❌ | ✅ | ✅ |
| Required reviewers in Environments | ❌ | ✅ | ❌ (Enterprise only) |
| Actions minutes | ~2,000/month | no cost on standard runners | ~3,000/month |

Only the public repo allows, at no cost, that agents cannot merge or deploy to production without the person ([ADR-0041](0041-agent-boundaries.md)).

## Decision

The repo is **public**, in the free `worKampo` organization.

- **The name does not protect** (2026-11-14): a public repo is found just the same by search and index, whatever it is called. `workampo` is kept in the email, GitHub and Cloudflare. The Cloudflare subdomain and the email do not reveal code, and browser JavaScript is public on any website.
- **While the repo is public, the following does not enter** code, `docs/`, issues, PRs or commit messages:

| Does not enter | Where it goes |
|---|---|
| Secrets, tokens, keys, `.dev.vars` | Cloudflare secrets and Environment secrets ([ADR-0041](0041-agent-boundaries.md)) |
| Personal data of customers or users, real emails, names of people | Sentry and the database; people, by role ([ADR-0045](0045-project-profile.md)) |
| Business strategy: unpublished prices, margins, real or potential customers, business metrics, commercial agreements, unannounced product plans | Private repo `worKampo/business` (free: it deploys nothing, needs no rulesets) |
| Code of the vertical product with its own competitive value (sector rules, calculations, partner integrations) | Activates the trigger (below) |
| Unpatched vulnerabilities and exploitable details of security incidents | *Private vulnerability reporting* and private *security advisories*; after the fix, a public summary if it adds value |
| Exact anti-abuse thresholds (request limits, Turnstile) | Environment variables, not constants in code |
| Source maps published with the web | Uploaded only to Sentry |

  - Identifiers that give no access (Cloudflare Account ID, names of Workers and bindings) may be present ([ADR-0045](0045-project-profile.md)).
  - Security never depends on the code being secret: it is covered by the security reviewer, the isolation tests and secrets kept out of the repo.
- **Measures**:
  - No `LICENSE`, with a notice in `README.md`: "© worKampo. All rights reserved. The source is visible but not licensed for any use."
  - Source maps: the build generates them, they are uploaded to Sentry and deleted before deployment. CI fails if the deployment contains `.map` files.
  - GitHub secret scanning and push protection, plus gitleaks in pre-commit (already decided).
  - CI fails if the diff contains emails that are not from the seed's test domain (`*.test`, `example.com`) nor the project's *noreply*.
- **Agent alarms**:
  - The "No entra" list lives in `AGENTS.md` and in `REVIEW.md`. Before writing to the repo, an issue, a PR or a commit, the agent checks it.
  - If something it is asked to include is on the list, it is a **mandatory stop** (stop 2 of [ADR-0020](0020-ticket-lifecycle.md): what is published in a public repo cannot be withdrawn). It stops, says what it is and proposes where it goes.
  - A finding from the list is a failure the orchestrator resolves before moment 2. CI blocks what it detects by itself (secrets, emails, `.map` files). The list is reviewed, via `REVIEW.md`: in L by the security reviewer, in M by the spec reviewer and in S by CodeRabbit and the orchestrator.
  - At moment 1, the orchestrator warns if a ticket activates the trigger ("this ticket introduces vertical code with its own value: D43").
- **Trigger to go private**: the first paying customer, or the first vertical code with its own competitive value. It is decided with an ADR between:
  - **Everything private with GitHub Team** (about $4 per user per month): keeps the rulesets. The required reviewer in private Environments is Enterprise only, so production approval becomes a manual workflow that only the person can launch. Check the plans in the GitHub documentation when deciding.
  - **Split**: the base stays public and the vertical goes in a private repo that consumes it.

## Consequences

- **License: none.** Without a `LICENSE` file, the code is visible but all rights are reserved (it is not open source). Opening it (FSL, MIT…) would be a separate decision.
- Repo **`worKampo/workampo`** (decided 2026-11-13). Locally it lives at `C:\Dev\SaaS\workampo\`, inside the umbrella folder `C:\Dev\SaaS\` (no git), next to `prototype\` (canvas viewer, outside the repo). `docs/` moves into the repo in ticket 1.
- GitHub **secret scanning and push protection** enabled, plus gitleaks in pre-commit ([ADR-0032](0032-security-reviewer.md)).
- **Issues and PRs are public too**: never personal data of customers or users (GDPR, [ADR-0027](0027-legal-and-data-protection.md)). Bugs link to Sentry instead of copying data.
- **Vulnerabilities**: reported through GitHub *private vulnerability reporting*, never in a public issue (`security.txt` will say so, [ADR-0032](0032-security-reviewer.md)).
- Design documents (`docs/`) are public; they contain nothing sensitive.

## Updates

- 2026-11-24 (the person, ticket 148): the allowed emails are the one list in [review](../process/review.md#no-entra): the project's own *noreply* (no other GitHub account's) and the test domains `*.test`, `*.example`, `example.com` and `example.org`. The "No entra" list lives in `AGENTS.md` and `docs/process/review.md`.
