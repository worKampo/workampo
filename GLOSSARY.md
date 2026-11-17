# Glossary

One term per concept, grouped as in [ADR-0036](docs/adr/0036-language-and-glossary.md). Each entry gives the meaning here, its GitHub equivalent when it has one, and the ADR that decides it. Language policy: [vision](docs/product/vision.md).

## Product

### company

A business that uses the product; the unit that owns data and a public landing. Code name: tenant. [ADR-0024](docs/adr/0024-vision-domains-prds-and-tickets.md).

### user

A person with an account; one user can belong to several companies. [ADR-0054](docs/adr/0054-roles-and-permissions.md).

### membership

The link between a user and a company, which carries the role (`members.role`). [ADR-0054](docs/adr/0054-roles-and-permissions.md).

### role

What a member may do in a company: `owner`, `admin` or `member`, fixed in code. [ADR-0054](docs/adr/0054-roles-and-permissions.md).

### staff

The platform team, separate from company roles; enters a company through "Enter as". [ADR-0050](docs/adr/0050-enter-as-staff-impersonation.md).

### tenant

Same as company; the word used in code and routing (`resolveTenant`, `tenant_id`). [ADR-0005](docs/adr/0005-dual-resolve-tenant.md).

### slug

The company's unique short name; the only company address stored in the database, hosts and URLs are derived from it. [ADR-0005](docs/adr/0005-dual-resolve-tenant.md).

### landing

The company's public page, made of sections rendered to HTML in the Worker. [ADR-0004](docs/adr/0004-landings-rendered-in-the-worker.md).

## Process

### vision

`docs/product/vision.md`: vision, language policy, global non-functional requirements and roadmap; every PRD inherits it. [ADR-0024](docs/adr/0024-vision-domains-prds-and-tickets.md).

### domain

A business context with its own rules and vocabulary and a living spec: `access`, `companies`, `billing`, `public-site`. GitHub: label `area:<domain>`. [ADR-0052](docs/adr/0052-living-specs-only-and-flow-by-size.md).

### support label

An `area:` label without a living spec that only filters the board: `platform`, `content`, `backoffice`. GitHub: labels `area:platform`, `area:content`, `area:backoffice`. [ADR-0052](docs/adr/0052-living-specs-only-and-flow-by-size.md).

### PRD

Temporary product document and parent of its tickets; closed when its outcome is met. GitHub: parent issue labelled `type:prd`; the PRD is its body. [ADR-0034](docs/adr/0034-prds-slicing-and-ticket-format.md).

### hypothesis

Optional PRD statement: "we believe that [change] will make [users] [behavior]; we will know when [metric] reaches [threshold] in [period]". GitHub: section of the PRD issue body. [ADR-0034](docs/adr/0034-prds-slicing-and-ticket-format.md).

### outcome review

Comment added when closing a PRD that had a hypothesis, with the result and the decision (continue, adjust or withdraw). GitHub: "Outcome review" comment on the PRD issue. [ADR-0034](docs/adr/0034-prds-slicing-and-ticket-format.md).

### ticket

One branch, one PR, one commit; its intent is the issue body and its change spec is the living-spec diff. GitHub: issue (sub-issue of the PRD, or standalone). [ADR-0024](docs/adr/0024-vision-domains-prds-and-tickets.md).

### ticket size (S/M/L)

Risk and process class of a ticket, set by three questions in order and confirmed by the person; it decides how much work and automatic review precede moment 2. GitHub: label `size:S`, `size:M` or `size:L`. [ADR-0052](docs/adr/0052-living-specs-only-and-flow-by-size.md).

### task

A piece of a ticket worth hours, committed one by one. GitHub: checkbox in the ticket's issue (row of `tasks.md` on the branch). [ADR-0024](docs/adr/0024-vision-domains-prds-and-tickets.md).

### wave

A group of tasks after which `pnpm check` must be green; the first wave is the failing tests. [ADR-0017](docs/adr/0017-verifiable-harness.md).

### living spec

`docs/domains/<domain>.md`: the current behaviour of a domain, always up to date. See [`docs/domains/README.md`](docs/domains/README.md). [ADR-0024](docs/adr/0024-vision-domains-prds-and-tickets.md).

### change spec

The diff of the living spec in the ticket's PR: what changed; frozen from its approval. GitHub: PR diff. [ADR-0024](docs/adr/0024-vision-domains-prds-and-tickets.md).

### @wip / @issue / @id

Gherkin tags of the living spec: `@wip(#n)` rule under construction (never in `master`), `@issue(#n)` last issue that changed the rule, `@id:<domain>-<issue>-<n>` stable identifier of an example. GitHub: issue number `#n`. [ADR-0052](docs/adr/0052-living-specs-only-and-flow-by-size.md).

### moment

One of the three points where the person intervenes, the same for every size: 1 ask (approve examples), 2 check (approve the PR), 3 publish (approve production). [ADR-0020](docs/adr/0020-ticket-lifecycle.md).

### mandatory stop

One of the five cases where the agent must stop and ask between moments: behaviour ambiguity, irreversible action, new cost or provider, uncovered critical zone, stuck. [ADR-0020](docs/adr/0020-ticket-lifecycle.md).

### verification package

What the orchestrator publishes on reaching moment 2: how to start it, test list, what was checked, decisions made, what is not verifiable locally, code worth looking at. GitHub: "Work log" comment on the issue. [ADR-0020](docs/adr/0020-ticket-lifecycle.md).

### protected acceptance scenario

A Playwright end-to-end test per approved example, written before the implementation by someone other than the implementer, and reopened only with `/reopen-acceptance`. [ADR-0030](docs/adr/0030-test-designer.md).

### walking skeleton

The first slice of a PRD: the minimal happy path end to end. [ADR-0034](docs/adr/0034-prds-slicing-and-ticket-format.md).

### learning

A 1-3 line entry in `docs/learnings.md`: when it applies, rule, why, link. GitHub: proposed in the issue's closing comment. [ADR-0052](docs/adr/0052-living-specs-only-and-flow-by-size.md).

### Definition of Ready / Done

Ready: capability, value, one example, slicing approved, dependencies resolved or planned, size confirmed. Done: clean observation window of the release. GitHub: board columns Ready and Done. [ADR-0034](docs/adr/0034-prds-slicing-and-ticket-format.md).

## Delivery

### PR

Pull request: one ticket, squash-merged into `master`; carries the "Plan" and "Verification" comments. GitHub: pull request. [ADR-0042](docs/adr/0042-traceability.md).

### CI

The automatic checks on every PR (`pnpm check`, traceability, example-to-test matrix). GitHub: GitHub Actions. [ADR-0013](docs/adr/0013-ci-cd-with-github-actions.md).

### staging

The real platform with real services where each merge is deployed automatically before production. [ADR-0023](docs/adr/0023-branching-and-deployment.md).

### release

A version in production under observation until the window closes. GitHub: board column Release. [ADR-0037](docs/adr/0037-roadmap-board-and-wip-limit.md).

### rollback

Returning a Worker to a previous version; it does not revert data or schema. GitHub: `wrangler rollback`. [ADR-0013](docs/adr/0013-ci-cd-with-github-actions.md).

### revert

Undoing a merge on `master` when staging fails and it is not fixed right away. GitHub: revert of the squash commit. [ADR-0023](docs/adr/0023-branching-and-deployment.md).

### hotfix

Urgent production fix (SEV1/SEV2) that passes through staging; follows the S path. GitHub: branch `hotfix/<issue>-<slug>`. [ADR-0023](docs/adr/0023-branching-and-deployment.md).

### bugfix

Fix of a bug that did not reach production or can wait; normal cycle. GitHub: branch `bugfix/<issue>-<slug>`, label `type:bug`. [ADR-0023](docs/adr/0023-branching-and-deployment.md).

### feature flag

A switch that separates deploying from activating; the catalog lives in `DB_GLOBAL`. [ADR-0009](docs/adr/0009-catalog-flags-and-sessions-in-d1.md).

### expand/contract

Three-step migration pattern (expand, migrate, contract) so that a rollback never meets an incompatible schema. [ADR-0033](docs/adr/0033-expand-contract-migrations.md).

### observation window

Period after release that must stay clean before the ticket is closed. Its length: not decided. GitHub: ticket moves to Done when it closes. [ADR-0034](docs/adr/0034-prds-slicing-and-ticket-format.md).

## Operations

### SLO

Service level objective: API availability 99.5 % monthly, latency p95 under 500 ms. [ADR-0039](docs/adr/0039-operations-and-incidents.md).

### SEV

Incident severity, 1 to 3, that decides the response. GitHub: label `sev:1` to `sev:3`. [ADR-0039](docs/adr/0039-operations-and-incidents.md).

### incident

A production failure tracked until fixed. GitHub: issue labelled `sev:*`. [ADR-0039](docs/adr/0039-operations-and-incidents.md).

### postmortem

Blameless review for SEV1 and SEV2 with timeline, impact, root cause and actions; actions become tickets. GitHub: issue. [ADR-0039](docs/adr/0039-operations-and-incidents.md).

### runbook

Step-by-step operation guide in `docs/runbooks/`: deploy, rollback, D1 restore, secret rotation, domain purchase. [ADR-0039](docs/adr/0039-operations-and-incidents.md).

### DORA

Four delivery metrics (deployment frequency, lead time, change failure rate, time to restore) computed from GitHub. GitHub: computed from GitHub. [ADR-0040](docs/adr/0040-process-metrics-and-monthly-review.md).
