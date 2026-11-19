# Procedure: living specs and example ids

Format and tags: [docs/domains/README.md](../domains/README.md). Why: [ADR-0052](../adr/0052-living-specs-only-and-flow-by-size.md).

## Ids: `pnpm specs:ids [--check]`

Gives each example under a `Rule:` tagged `@wip(#n)` the next free `@id:<domain>-<n>-<k>` of its file (`<domain>` is the file name, e.g. `@id:companies-15-1`). Ids already there are kept; numbering continues per issue. With `--check` it writes nothing and exits 1 listing the examples without an id.

## Tags through the ticket

1. The test designer writes the rule with `@wip(#n)`, then runs `pnpm specs:ids`.
2. Tests and acceptance scenarios cite the `@id` ([testing](testing.md)).
3. `pnpm work pr` turns `@wip(#n)` into `@issue(#n)` ([work](work.md)).

CI checks that every `@id` has a test that cites it and that no test cites a missing one, and posts the "Verification" comment ([traceability](traceability.md#ci-checks)).
