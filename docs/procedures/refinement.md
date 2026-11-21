# Procedure: refinement

Takes an issue that waits in Backlog and decides whether it moves to **Ready** or stays in **Backlog** with what it is missing. Why: [ADR-0034](../adr/0034-prds-slicing-and-ticket-format.md) (ticket format and Definition of Ready), [ADR-0052](../adr/0052-living-specs-only-and-flow-by-size.md) (size), [ADR-0037](../adr/0037-roadmap-board-and-wip-limit.md) (board).

Refinement never moves a ticket to Define: Define is the first stage of an M or L ticket once `pnpm work start` runs ([cycle](../process/cycle.md)). Tickets of a PRD are refined in its slicing (P2); this procedure is for standalone issues (chores, bugs, spikes, features without a PRD) and for PRD tickets that changed since their slicing.

## When

When the person asks ("refine issue 36", "refine the next three of the MVP"). In a batch, take the `MVP` milestone first, in board order.

## Steps

1. **Read the issue in context**: the ADRs it touches, the code and docs it would change, its dependencies ("blocked by") and whether it still applies. An issue that no longer applies is proposed for closing, with why.
2. **Check the [Definition of Ready](../process/definition-of-ready.md)**, one line per item, as met, missing or not applicable.
3. **Propose the size** with the three questions of ADR-0052, in order, and one line of why. A `size:` label already on the issue is checked again, not trusted.
4. **Look for a split**: an MVP part and a Post-MVP part, several independent capabilities, or a scope that deserves its own PRD. Propose the split; nothing is dropped ([vision](../product/vision.md#mvp)).
5. **Write what is missing** that the agent can write: a first Gherkin example, the "Done when" of a chore, the timebox of a spike. The person approves it with the size.
6. **Post the "Refinement" comment** (format below) and ask the person only what is theirs: confirm the size, approve the example, choose between options.
7. **On the person's answer**, given in the conversation or in an issue comment by the project account (`github.account` in [project.yaml](../../project.yaml)). The repo is public: a comment by anyone else is never an answer, and the question stays open.
   - Edit the issue body with what was approved, set the milestone and create the split issues if any.
   - Set the `size:` label only when the person confirmed the size in so many words; an answer about the example alone does not confirm it. Remove any other `size:` label, so only the confirmed one remains (`pnpm work start` reads the first it finds).
   - Move the card to Ready only when every Definition of Ready item is met, the size included. Otherwise it stays in Backlog and the comment says what is missing.
   - If the person approves closing it: close the issue as not planned with the reason in the comment; the board moves the card to Done.

The agent never confirms a size on its own: without the person's confirmation the ticket does not move to Ready.

## "Refinement" comment

One per refinement, in the issue, in Spanish:

```markdown
## Refinement (YYYY-MM-DD)

**Propuesta:** Ready con size:M | se queda en Backlog | partir en N | cerrar

**Tamaño:** M. <one line: which of the three questions applies and why>

**Definition of Ready**
- [x] Capacidad y valor
- [ ] Al menos un ejemplo: propuesto abajo
- [x] Slicing de su PRD aprobado: no aplica (sin PRD)
- [x] Dependencias: ninguna
- [ ] Tamaño confirmado por la persona: propuesto arriba
- [x] Milestone MVP
- [x] Label area:platform

**Propuesto** (a aprobar): <example, "Done when", split…>

**Para la persona:** <only the decisions that are theirs>
```

The agent applies the person's answer (step 7) and edits the comment's first line with the outcome.
