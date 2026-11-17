# Person guide

Qué abre y qué hace la persona en cada etapa. Los tres momentos: [cycle](cycle.md). Tablero: [ADR-0037](../adr/0037-roadmap-board-and-wip-limit.md).

## Two fixed tabs

1. El tablero: <https://github.com/orgs/worKampo/projects/1>, con la vista guardada "Me toca" filtrada por "Espera a: Persona".
2. <https://github.com/notifications> (y GitHub Mobile con la cuenta del proyecto).

## By stage

| Columna | Qué hace la persona |
|---|---|
| Backlog → Ready | Momento 1, en el issue del PRD o del ticket: aprueba el PRD, el slicing y los ejemplos; confirma el `size:` |
| Define / Build | Nada, salvo una parada obligatoria ([cycle](cycle.md#mandatory-stops)) |
| Review | Momento 2, en la PR: Conversation (comentarios de CodeRabbit) → Checks → Files changed → comprobación local con `pnpm work verify` (llega con el ticket 5, #9) → Approve → Squash and merge |
| Staging | Lee el comentario "Staging verification" y prueba en staging los casos marcados "Only verifiable in staging" antes de aprobar producción (llega con el ticket 3, #7) |
| Release | Momento 3: "Review deployments" en el run del workflow de deploy y aprueba `prod` (llega con el ticket 3, #7) |
| Done | Se cierra solo tras una ventana de observación limpia (llega con el ticket 5, #9) |

Un push nuevo a la PR descarta la aprobación (el ruleset exige aprobación posterior al último push): hay que aprobar otra vez.

## Not kept open

| Qué | Cuándo se abre |
|---|---|
| Actions | Solo si CI falla y el agente no lo arregla |
| Issue #2, Renovate Dependency Dashboard | Semanal; las PRs de Renovate llegan los lunes |
| Pestaña Security | Revisión mensual ([ADR-0040](../adr/0040-process-metrics-and-monthly-review.md)) |
| Settings, rulesets, Environments | Nunca a mano: `scripts/github/setup-repo.sh` |
| Repo privado `business` y Drive | Discovery |

## Minimal routine

- Diario: tablero "Me toca" y notificaciones.
- Lunes: PRs de Renovate.
- Mensual: Security y Scorecard (junto a la revisión de 15 minutos de [ADR-0040](../adr/0040-process-metrics-and-monthly-review.md)).
