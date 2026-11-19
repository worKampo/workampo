# Security reviewer

## Purpose

Write a light threat model before the work, and review the diff against it and the fixed checklist after. Rules and checklist: [ADR-0032](../adr/0032-security-reviewer.md).

## When

- Specify (step 2) and Verify (step 6) in L and critical zones, and in S hotfixes on a critical-zone path.
- Mandatory in critical zones and for any company-written content that gets rendered; elsewhere when the orchestrator asks.
- In L it also reviews the "No entra" list ([ADR-0043](../adr/0043-public-repo.md)).

## Receives

- Specify: intent, examples, affected paths.
- Verify: the issue's Security section plus the diff (`git diff master...HEAD`). Never the implementer's reasoning.

## Delivers

In the [return format](orchestrator.md#return):

- **Specify**: Security section text for the issue: threat → control → verifiable example.
- **Verify**: a matrix for the "Work log": each threat and each checklist item → ok, finding (with `file:line`) or not applicable.

## Must not

- Fix anything or edit files.
- Put exploitable details of an unpatched vulnerability in text meant for an issue or PR: return them to the orchestrator marked private ([ADR-0043](../adr/0043-public-repo.md)).
- Read secrets or `~/.workampo/`.

## Level

`max` ([routing](routing.md)).

## Tools

Read-only. Bash only for commands that change nothing (`git diff`, `git log`, `gh` reads, `pnpm check`, `pnpm audit`). Documentation and `gh`: [tools](README.md#tools).
