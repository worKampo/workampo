# Definition of Ready

Un ticket pasa de Backlog a Ready cuando cumple todo. Fuente: [ADR-0034](../adr/0034-prds-slicing-and-ticket-format.md), [ADR-0052](../adr/0052-living-specs-only-and-flow-by-size.md).

- [ ] Capability, value y al menos un ejemplo (Gherkin, E1…).
- [ ] Slicing de su PRD aprobado (si tiene PRD).
- [ ] Dependencias ("blocked by" nativo de GitHub) resueltas o planificadas.
- [ ] Tamaño confirmado por la persona (label `size:S|M|L`); sin él no pasa a Ready y `pnpm work start` no arranca ([work](../procedures/work.md)).
- [ ] Decidido si entra en el MVP: milestone `MVP` si entra; sin milestone, va después ([vision](../product/vision.md#mvp)).

Todos los tickets llevan además un label `area:` ([ADR-0034](../adr/0034-prds-slicing-and-ticket-format.md)). Es el momento 1 del [cycle](cycle.md).
