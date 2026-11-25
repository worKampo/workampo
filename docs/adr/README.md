# Architecture decision records

Every architectural and process decision of worKampo, one file per decision ([MADR](https://adr.github.io/madr/) format, in English).

- **Numbering**: `ADR-NNNN` keeps the number of the former decision `DNN`. Older text, labels and comments that cite `D53` mean [ADR-0053](0053-code-conventions.md).
- **Gaps**: 0046, 0055 and 0061 were deferred proposals and live as [notes](#notes).
- **Changing a decision**: a new ADR that supersedes the old one (`status: superseded by ADR-NNNN`). Accepted ADRs are not rewritten. When the new ADR replaces only some points, the old one stays `accepted`, its index row says "partly replaced by ADR-NNNN" and a dated Update in it names the points (decided by the person on 2026-11-24).
- **Small adjustments** (a file moves, a pending check is resolved, a detail is decided within the decision): a dated note in an `## Updates` section of the ADR, approved by the person. If the adjustment reverses or replaces what the ADR decided, it is a new ADR instead (decided by the person on 2026-11-18).
- **Product vision, language policy, global non-functional requirements and roadmap**: [vision](../product/vision.md).

## Product and scope

| ADR | Title | Status |
|---|---|---|
| [ADR-0001](0001-generic-saas-base.md) | Product: generic SaaS base | accepted |
| [ADR-0002](0002-v1-scope-web-and-d1.md) | Scope of v1: web + D1 | accepted |
| [ADR-0003](0003-documentation-in-the-repo.md) | Documentation in the repo | accepted |

## Tenancy, routing and session

| ADR | Title | Status |
|---|---|---|
| [ADR-0004](0004-landings-rendered-in-the-worker.md) | Landings rendered in the Worker | accepted |
| [ADR-0005](0005-dual-resolve-tenant.md) | Dual `resolveTenant()` by configuration | accepted |
| [ADR-0006](0006-same-origin-route-map.md) | Route map on the same origin | accepted |
| [ADR-0007](0007-central-login.md) | Central login | accepted |
| [ADR-0008](0008-own-session-in-d1-host-only-cookie.md) | Own session in D1, host-only cookie | accepted |
| [ADR-0009](0009-catalog-flags-and-sessions-in-d1.md) | Catalog, flags and sessions only in D1 | accepted |
| [ADR-0010](0010-shard-1-from-v1.md) | `DB_SHARD_1` from v1 | accepted |

## Infrastructure and environments

| ADR | Title | Status |
|---|---|---|
| [ADR-0011](0011-environments-without-extra-domain-cost.md) | Environments without extra domain cost | accepted |
| [ADR-0012](0012-workers-static-assets-no-pages.md) | Workers + Static Assets, no Pages | accepted |
| [ADR-0013](0013-ci-cd-with-github-actions.md) | CI/CD with GitHub Actions | accepted |
| [ADR-0014](0014-buying-a-domain-is-a-config-change.md) | Buying a domain = changing configuration | accepted |

## Development platform

| ADR | Title | Status |
|---|---|---|
| [ADR-0015](0015-agent-context-multi-tool.md) | Agent context, multi-tool | accepted |
| [ADR-0016](0016-procedure-harness.md) | Procedure harness | accepted |
| [ADR-0017](0017-verifiable-harness.md) | Verifiable harness | accepted |
| [ADR-0018](0018-turborepo-and-generators.md) | Turborepo and generators | accepted |
| [ADR-0019](0019-typed-contract-with-hono-rpc.md) | Typed contract with Hono RPC | accepted |

## Product and process

| ADR | Title | Status |
|---|---|---|
| [ADR-0020](0020-ticket-lifecycle.md) | Ticket lifecycle | accepted (closing of tickets with no Worker change superseded by ADR-0068) |
| [ADR-0021](0021-orchestrator-and-subagents.md) | Orchestrator and subagents | accepted |
| [ADR-0022](0022-model-and-effort-by-complexity.md) | Model and effort by complexity | accepted |
| [ADR-0023](0023-branching-and-deployment.md) | Branching and deployment | accepted |
| [ADR-0024](0024-vision-domains-prds-and-tickets.md) | Vision, domains, PRDs and tickets | accepted |
| [ADR-0025](0025-user-help-with-starlight.md) | User help with Starlight | accepted |
| [ADR-0026](0026-user-changelog.md) | User changelog | accepted |
| [ADR-0027](0027-legal-and-data-protection.md) | Legal and data protection | accepted |
| [ADR-0028](0028-images-in-documentation.md) | Images in documentation | accepted |
| [ADR-0029](0029-testing-strategy.md) | Testing strategy | accepted (partly replaced by ADR-0076) |
| [ADR-0030](0030-test-designer.md) | Test designer | accepted (partly replaced by ADR-0076) |
| [ADR-0031](0031-ui-ux-designer.md) | UI/UX designer: interface, accessibility and SEO | accepted |
| [ADR-0032](0032-security-reviewer.md) | Security reviewer | accepted |
| [ADR-0033](0033-expand-contract-migrations.md) | Expand/contract migrations | accepted |
| [ADR-0034](0034-prds-slicing-and-ticket-format.md) | PRDs, slicing and ticket format | accepted |
| [ADR-0035](0035-technical-work-and-bootstrap-prd.md) | Technical work and bootstrap PRD | accepted |
| [ADR-0036](0036-language-and-glossary.md) | Language and glossary | accepted |
| [ADR-0037](0037-roadmap-board-and-wip-limit.md) | Roadmap, board and work-in-progress limit | accepted |
| [ADR-0038](0038-product-analytics.md) | Product analytics | accepted |
| [ADR-0039](0039-operations-and-incidents.md) | Operations and incidents | accepted |
| [ADR-0040](0040-process-metrics-and-monthly-review.md) | Process metrics and monthly review | accepted |
| [ADR-0041](0041-agent-boundaries.md) | Agent boundaries | accepted |
| [ADR-0042](0042-traceability.md) | Traceability between pieces | accepted (Branch and PR rows superseded by ADR-0067) |
| [ADR-0043](0043-public-repo.md) | Public repo | accepted |
| [ADR-0044](0044-migrations-reference-data-seeds-and-backfills.md) | Migrations, reference data, seeds and backfills | accepted (partly replaced by ADR-0074) |
| [ADR-0045](0045-project-profile.md) | Project profile (`project.yaml`) | accepted |

## Product capabilities and conventions

| ADR | Title | Status |
|---|---|---|
| [ADR-0047](0047-i18n-from-the-start.md) | Internationalization from the start | accepted |
| [ADR-0048](0048-separate-backoffice-worker-and-account-limits.md) | Backoffice as a separate Worker and Cloudflare account limits | accepted |
| [ADR-0049](0049-platform-content.md) | Platform content: mixed model | accepted |
| [ADR-0050](0050-enter-as-staff-impersonation.md) | "Enter as" (staff impersonation) | accepted |
| [ADR-0051](0051-stripe-checkout-and-customer-portal.md) | Billing with Stripe Checkout and Customer Portal | accepted |
| [ADR-0052](0052-living-specs-only-and-flow-by-size.md) | Only living specs in `master`, and flow by size | accepted |
| [ADR-0053](0053-code-conventions.md) | Code conventions | accepted (partly replaced by ADR-0075, role in `members` superseded by ADR-0072) |
| [ADR-0054](0054-roles-and-permissions.md) | Roles and permissions | accepted (roles in code only, one role per member for the whole company and the three-role matrix superseded by ADR-0072) |

## Delivery, tooling and data

| ADR | Title | Status |
|---|---|---|
| [ADR-0056](0056-async-work.md) | Async work | accepted |
| [ADR-0057](0057-ready-for-a-mobile-app.md) | Ready for a mobile app | accepted |
| [ADR-0058](0058-agent-and-repo-tooling.md) | Agent and repo tooling | accepted |
| [ADR-0059](0059-web-client-version.md) | Web client version | accepted |
| [ADR-0060](0060-deploy-affected-workers-only.md) | Deploy affected Workers only | accepted |
| [ADR-0062](0062-files.md) | Files: R2, images and PDFs | accepted |
| [ADR-0063](0063-eu-data-residency.md) | EU data residency | accepted (WorkOS EU-region check superseded by ADR-0071) |
| [ADR-0064](0064-local-secrets.md) | Local secrets | accepted |

## Cost and design

| ADR | Title | Status |
|---|---|---|
| [ADR-0065](0065-zero-spend-and-free-tier-limits.md) | Zero spend and free-tier limits | accepted |
| [ADR-0066](0066-design-system.md) | Design system: neutral chrome, ink accent, IBM Plex Sans | accepted (sole ink accent, brand colour and public-page themes superseded by ADR-0070) |
| [ADR-0067](0067-ticket-branches-not-linked.md) | Ticket branches are not linked to the issue | accepted |
| [ADR-0068](0068-close-tickets-without-a-release.md) | Close tickets whose merge deploys no Worker | accepted |
| [ADR-0069](0069-board-app-in-ci.md) | A board-only GitHub App moves cards from CI | accepted |
| [ADR-0070](0070-colour-commercial-emphasis-and-marketing.md) | Colour for business moments and free rein on marketing pages | accepted |
| [ADR-0071](0071-identity-providers.md) | Identity providers as plug-ins; WorkOS for the MVP | accepted |
| [ADR-0072](0072-organization-units-and-scoped-roles.md) | Organization units in a tree and roles scoped to a branch | accepted |
| [ADR-0073](0073-frontend-stack-and-rate-limiting.md) | Frontend stack of the SPA and rate limiting on D1 | accepted |
| [ADR-0074](0074-seeds-in-sql.md) | Seeds in SQL | accepted (replaces ADR-0044's seed format) |
| [ADR-0075](0075-api-entry-logic-and-data.md) | API layout with entry, logic and data apart | accepted (replaces the API names of ADR-0053's Update of 2026-11-23) |
| [ADR-0076](0076-test-placement-after-the-reorganisation.md) | Where tests live after the reorganisation | accepted (replaces test placement in ADR-0029 and pre-acceptance commits in ADR-0030) |
| [ADR-0077](0077-database-engines-behind-the-repos.md) | Database engines behind the repos | accepted |
| [ADR-0078](0078-api-urls-contracts-and-behaviour.md) | API URLs, contracts and behaviour | accepted |

## Notes

Deferred proposals and reference material; not decisions.

- [Documentation tooling](../notes/docs-tooling.md)
- [Global templates copied to each company](../notes/global-templates.md)
- [Known failures of the deferred pieces](../notes/known-failures-of-deferred-pieces.md)
- [Local harness panel](../notes/local-harness-panel.md)
- [Working on multiple machines](../notes/multiple-machines.md)
- [Reusable from the previous project](../notes/reuse-from-previous-project.md)
- [Verification (2026-11-09 and 2026-11-10, official documentation)](../notes/verification-2026-11.md)
- [Bootstrap: name and accounts](../process/bootstrap.md) (Spanish)
