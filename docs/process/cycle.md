# Cycle

Ciclo de vida de un ticket. El porqué: [ADR-0020](../adr/0020-ticket-lifecycle.md), [ADR-0052](../adr/0052-living-specs-only-and-flow-by-size.md), [ADR-0021](../adr/0021-orchestrator-and-subagents.md).

## The person's three moments

La persona interviene tres veces, igual en todos los tamaños. Entre momentos el agente trabaja solo.

| Moment | Cuándo | Qué hace la persona | Dónde |
|---|---|---|---|
| 1. Ask | PRD y slicing; en tickets sueltos, al crear el issue | Aprueba el PRD, la lista de tickets con su tamaño y los ejemplos (E1, E2…) de todos a la vez | Issue del PRD o del ticket |
| 2. Check | PR abierta, CI verde y reviews atendidas | Sigue la lista de pruebas en local (`pnpm work verify #n`, llega con el ticket 5, #9), mira el código señalado; aprueba la PR (merge) o devuelve hallazgos | PR; paquete en el comentario "Work log" del issue |
| 3. Publish | Smoke de staging verde | Prueba en staging solo lo marcado "Only verifiable in staging" y promueve a producción | Comentario "Staging verification"; aprobación de `prod` (llega con el ticket 3, #7) |

## Steps

Once pasos para el agente. S y M acortan el camino ([Flow by size](#flow-by-size)).

| Stage | Step | Responsable | Resultado |
|---|---|---|---|
| Define | 1. Discover | Researchers; en un PRD, el slicer | Intención en el issue (momento 1) |
| | 2. Specify | Orchestrator (+ UI/UX, security si aplica) | Ejemplos Gherkin numerados en el issue (momento 1) |
| | 3. Design | Planner (solo L) | `.work/plan.md` temporal en la rama |
| | 4. Tasks | Planner + test designer | Diff de la living spec (`@wip(#n)`), escenarios protegidos, `.work/tasks.md` con tests `it.fails` en la primera wave |
| Build | 5. Implement | Implementers (TDD, un commit por task, waves) | Commits; `pnpm check` verde por wave |
| | 6. Verify | Spec reviewer, verifier (+ UI/UX, security) | Hallazgos y rondas en "Work log"; paquete de verificación |
| | 7. Document | Writer | Ayuda, changelog y capturas si el cambio es visible |
| Deliver | 8. Pull request | Orchestrator con `pnpm work pr` | PR; CI genera "Verification"; CodeRabbit revisa. Momento 2 |
| | 9. Staging | Deploy automático, migraciones, smoke | Comentario "Staging verification". Momento 3 |
| | 10. Release | Deploy a producción, smoke de solo lectura, ventana de observación | Comentario "Release verification" |
| Learn | 11. Close | Orchestrator con `pnpm work close` | Issue cerrado; aprendizaje propuesto si lo hay |

Solo el orchestrator habla con la persona; los subagentes no hablan entre sí ni lanzan otros ([ADR-0021](../adr/0021-orchestrator-and-subagents.md)).

## Flow by size

El tamaño (`size:S|M|L` en el issue, confirmado por la persona) decide cuánto trabajo y revisión automática hay antes del momento 2, no cuántas veces le toca a la persona.

| Size | Camino | Revisión automática |
|---|---|---|
| S | El momento 1 es el propio issue; issue → rama → PR, tasks como checklist del issue; un bug empieza por su test de regresión | CI, CodeRabbit y paquete reducido del verifier; + security reviewer si toca una zona crítica o contenido escrito por empresas que se renderiza ([ADR-0032](../adr/0032-security-reviewer.md)) |
| M | Sin Design ni `.work/plan.md` (el plan cabe en `.work/tasks.md`): ejemplos aprobados → living spec y escenarios → tasks → PR | + test designer (escenarios protegidos), spec reviewer, UI/UX si aplica |
| L / zona crítica | Los once pasos, con `.work/plan.md` | + sección Security y security reviewer, nivel `max` |

Clasificación (la primera que aplica gana):
1. Toca zona crítica (sesión, aislamiento, migraciones, facturación, secretos), modelo de datos, contrato de API o migración: L.
2. Añade o cambia reglas de negocio (ejemplos de la living spec) o un patrón o componente de interfaz nuevo: M.
3. Si no: S.

El agente puede subir el tamaño en cualquier momento; bajarlo solo lo decide la persona. CI falla si el diff toca rutas críticas y el label no es `size:L`.

## Mandatory stops

El agente para y pregunta solo en estos cinco casos; todo lo demás lo decide y lo anota en "Decisions made" del paquete.

1. Ambigüedad que cambia el comportamiento, o la implementación contradice un ejemplo o diseño aprobado.
2. Algo irreversible: paso contract de una migración, borrar datos, cambiar un contrato de API en uso, publicar algo de la lista "No entra".
3. Coste o proveedor nuevo (dependencia de proveedor o servicio de pago).
4. Zona crítica no cubierta por la spec.
5. Atascado: tras 3 rondas del bucle Implement ↔ Verify o al agotar el presupuesto de intentos.

## Loops

- **Implement ↔ Verify**: máximo 3 iteraciones por fallos contra la spec; después, parada 5. Las rondas que abre la persona en el momento 2 no cuentan, pero se registran.
- **Hallazgos** (del agente, de CodeRabbit/CI o de la persona): fallo o ajuste dentro del alcance → nueva task → Implement → Verify; cambio de alcance → vuelve al momento 1 o issue nuevo. Nada se arregla sin task.
- **Ejemplos congelados desde el momento 1**: si algo los contradice es la parada 1; la persona aprueba de nuevo los ejemplos afectados.
- **Revisión de la PR**: el agente agrupa los arreglos de cada ronda en un único push ([ADR-0013](../adr/0013-ci-cd-with-github-actions.md)). Un push nuevo descarta la aprobación; la persona aprueba otra vez.
- **Staging y Release**: el código ya está en `master`, nada vuelve a la rama del ticket.

| Hallazgo | En Staging | En Release |
|---|---|---|
| Fallo grave | Revert en `master` si no se arregla ya, `bugfix/`, ciclo completo; no se promueve | Apagar el flag o rollback del Worker, `hotfix/` (lo confirma la persona) |
| Fallo menor o ajuste | La persona decide: bloquea (`bugfix/` antes de producción) o issue nuevo | `bugfix/` nuevo, ciclo normal |
| Cambio de alcance | Issue nuevo | Issue nuevo |
| Fallo de entorno | Se corrige la configuración sin tocar código y se anota en el runbook | Igual |

Ventana de observación en Release: un verifier programado revisa Sentry, métricas de Worker y SLOs. Limpia, el ticket pasa a Close sin intervención; si no, se avisa a la persona ([ADR-0039](../adr/0039-operations-and-incidents.md)). Duración: 24 horas desde el despliegue a producción ([runbook de deploy](../runbooks/deploy.md#release-observation-window)).

## State and log

- Estado actual: `.work/PROGRESS.md` hasta Document; comentario "Progress" de la PR durante la review; comentarios del issue en Staging y Release.
- Un único comentario "Work log" en el issue recoge saltos de fase, paradas, hallazgos, rondas y el paquete de verificación.
- Varios tickets a la vez: dentro del límite WIP (2 en Build, 1 PRD en slicing, [ADR-0037](../adr/0037-roadmap-board-and-wip-limit.md)).
- Mientras no existan las piezas de "Working foundation", se aplica el ciclo con las excepciones de [ADR-0035](../adr/0035-technical-work-and-bootstrap-prd.md) ([bootstrap](bootstrap.md)).

## Commands

Un solo script con subcomandos (llega con el ticket 5, #9): `pnpm work` (ayuda), `status`, `resume`, `start #n`, `inbox`, `verify #n`, `pr`, `close`. No hay comandos para mover tarjetas a mano: `start`, `pr` y `close` las mueven hasta Review y el workflow de deploy las mueve a Staging, Release y Done. Hasta entonces se hace a mano.

Ramas, PRs y fixes: [branching](branching.md). Entrada y salida de un ticket: [definition of ready](definition-of-ready.md), [definition of done](definition-of-done.md).
