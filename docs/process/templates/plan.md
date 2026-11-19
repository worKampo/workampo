# .work/plan.md template

Only for size L and critical zones. Temporary file on the ticket branch; `pnpm work pr` turns it into a "Plan" comment on the PR ([ADR-0052](../../adr/0052-living-specs-only-and-flow-by-size.md)). Sections: Design step of [ADR-0020](../../adr/0020-ticket-lifecycle.md).

```markdown
PRD #<n> · Ticket #<n> · Branch: <branch>

## Data model
Tables, columns, indexes, tenancy.

## API contracts
Endpoints, request and response shapes, errors, permissions.

## Migrations
Expand/contract steps and order; what is irreversible.

## Flags
Feature flags, default state, removal criterion.

## Analytics events
Event names and properties.

## Risks
What can go wrong and how it is mitigated.
```

Technical items that follow from the UI and Security sections of the issue (for example headers, validations) go here; they do not reopen the spec. What stays relevant after the merge moves to "Decisions made" of the verification package.
