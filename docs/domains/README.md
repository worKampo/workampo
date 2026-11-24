# Living specs

One file per domain in `docs/domains/`. It describes the behaviour the product has **today**, and it is updated in the same PR as the code that changes it. The why lives in the ADRs, which are not rewritten ([ADR-0052](../adr/0052-living-specs-only-and-flow-by-size.md), [ADR-0024](../adr/0024-vision-domains-prds-and-tickets.md)).

## Domains

| Spec | Includes |
|---|---|
| [`access`](access.md) | Login, session, one-time codes, staff access ("Enter as") |
| [`companies`](companies.md) | Company lifecycle, slug, settings, members and roles, invitations, ownership, deletion |
| [`billing`](billing.md) | Plans, plan limits and flags, payments, grace, plan changes |
| [`public-site`](public-site.md) | Company landing: sections, publishing, SEO, the company's content |

Support labels (`area:platform`, `area:content`, `area:backoffice`) have no spec: they only filter the board. A rule goes to the domain that owns it, never to a support label.

## Mold

Every spec has these four sections, in this order ([ADR-0052](../adr/0052-living-specs-only-and-flow-by-size.md)):

| Section | Content |
|---|---|
| Purpose | What the domain is for, in a few lines |
| Rules | `Rule:` blocks, each with its Gherkin examples |
| Terms | Links to entries of [`docs/glossary.md`](../glossary.md); no definitions here |
| Out of scope | What belongs to another domain or lives outside the specs |

Observable behaviour only: what a user or an API client can see. No tables, endpoints or libraries.

Language: headings in English; the body may be in Spanish ([ADR-0036](../adr/0036-language-and-glossary.md)). `Given` / `When` / `Then` stay in English.

## Ownership rule

A rule lives in the domain that owns the data or the decision, even if the screen is on another surface. "Only an owner can delete the company" goes in `companies`. Test: "how does X work?" is answered with a single file.

## Growth by division

When a domain exceeds about 300 lines it becomes a folder (`docs/domains/companies/team.md`, `invitations.md`…). Split when it hurts, not in advance.

## Marks

Gherkin tags ([ADR-0052](../adr/0052-living-specs-only-and-flow-by-size.md), [ADR-0042](../adr/0042-traceability.md)):

| Mark | Where | Meaning |
|---|---|---|
| `@wip(#n)` | On the `Rule:` | New or changed rule while work is on the branch. Never reaches `master`; CI checks it ([traceability](../procedures/traceability.md#ci-checks)) |
| `@issue(#n)` | On the `Rule:` | Last issue that changed the rule. One per rule, not per example. Replaces `@wip` when the PR is opened by `pnpm work pr` ([work](../procedures/work.md)) |
| `@id:<domain>-<issue>-<n>` | On each example | Stable identifier, e.g. `@id:companies-15-1`. Assigned by `pnpm specs:ids` ([living specs](../procedures/living-specs.md)) from the E1, E2… numbering of the issue. Each test cites it. An example without a test, or a test of a missing example, is a review failure; CI checks it ([traceability](../procedures/traceability.md#ci-checks)) |

What is under construction across the product is seen on the board, not in `master`.

Design-system components (`packages/ui`) are not a domain: their rules and examples live in [`docs/design/components.md`](../design/components.md), numbered E1, E2… without `@id`, and their tests cite those numbers (the person, ticket 126).

## Changing a rule

1. The examples are approved in the issue (moment 1, [ADR-0020](../adr/0020-ticket-lifecycle.md)).
2. On the branch they are edited directly in the spec, marked `@wip(#n)`; the PR diff is the change spec ([ADR-0024](../adr/0024-vision-domains-prds-and-tickets.md)).
3. The spec reviewer checks that it matches what was approved.

Every ticket that changes or clarifies behaviour updates the spec of its domain in the same PR, in every size. Examples come from the ticket format of [ADR-0034](../adr/0034-prds-slicing-and-ticket-format.md): Gherkin, no Cucumber.

## Example (illustrative, not a real rule)

```gherkin
@issue(#99)
Rule: A shelf can hold at most ten books

  @id:library-99-1
  Example: Adding an eleventh book is rejected
    Given a shelf with ten books
    When the reader adds another book
    Then the shelf still has ten books
    And the reader sees that the shelf is full
```
