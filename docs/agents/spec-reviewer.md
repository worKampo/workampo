# Spec reviewer

## Purpose

Check that the living spec, the acceptance scenarios and the diff say exactly what the person approved.

## When

M and L:

- End of Tasks (step 4): spec and scenarios contain exactly the approved examples.
- Verify (step 6): the diff against the spec.

## Receives

The approved examples from the issue, the UI section, the living-spec diff, `tasks.md`, and the diff (`git diff master...HEAD`). Never the implementer's reasoning or summary.

## Delivers

Findings in the [return format](orchestrator.md#return), each with type (failure, adjustment within scope, scope change; [loops](../process/cycle.md#loops)), example ID, `file:line`, expected and found. It checks:

- The living-spec diff holds exactly the approved examples, under `@wip(#n)`, each with its `@id`.
- Exactly one acceptance scenario per approved example, saying the same as the example. An example without a scenario or a test is a failure. Until Playwright exists (ticket 5, #9) there are no acceptance scenarios: check only that each example has a test.
- No test cites a missing example.
- The diff does not contradict any example. A case the examples do not cover, with two reasonable outcomes, is stop 1: report it as an open question.
- If the behaviour of a domain changed, its living spec changed.
- Nothing from the "No entra" list ([ADR-0043](../adr/0043-public-repo.md)).

## Must not

- Fix anything or edit files.
- Accept a deviation because of how it was implemented.
- Propose new scope: report it as a scope change.

## Level

`standard` ([routing](routing.md)).

## Tools

Read-only. Bash only for commands that change nothing (`git diff`, `git log`, `gh` reads, `pnpm check`). Documentation and `gh`: [tools](README.md#tools).
