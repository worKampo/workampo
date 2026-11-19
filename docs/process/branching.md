# Branching

Ramas, PRs y despliegue. El porqué: [ADR-0023](../adr/0023-branching-and-deployment.md), [ADR-0013](../adr/0013-ci-cd-with-github-actions.md), [ADR-0042](../adr/0042-traceability.md).

## Path

```
feature|bugfix|hotfix/<issue>-<slug>  <- desde master
  -> PR a master (CI + review de IA; reviews atendidas)
  -> momento 2: la persona comprueba en local y aprueba -> squash merge
  -> deploy automático a staging -> smoke
  -> momento 3: la persona prueba lo marcado y aprueba -> producción (el mismo commit)
  -> ventana de observación limpia -> Close
```

## Branch name

- Formato `<tipo>/<issue>-<slug>`, validado en CI con `^(feature|bugfix|hotfix)/\d+-[a-z0-9-]+$`; el número debe ser un issue abierto.
- Ejemplo: `feature/15-invite-by-email`.
- La crea `pnpm work start <n>` con `gh issue develop` (queda enlazada en *Development*) ([work](../procedures/work.md)).

## Pull requests

- Solo hay CI en PRs (`on: pull_request`); empieza con `pnpm work pr` ([work](../procedures/work.md)).
- Título conventional commit; cuerpo con `Ticket #N` (y `PRD #N` si tiene padre); mismos labels `type:` y `area:` que el ticket.
- Commits con conventional commit y trailer `Refs: #<ticket>` (y `PRD: #N`, `Task: Tn`). Nunca `Closes #N`: el ticket lo cierra el orchestrator tras la ventana de observación limpia.
- Autor con el email *noreply* de la cuenta del proyecto.
- Ninguna PR llega a `master` con `@wip` ni con `.work/PROGRESS.md`, `.work/plan.md` o `.work/tasks.md`.
- Un push nuevo descarta la aprobación (el ruleset exige aprobación posterior al último push): la persona aprueba otra vez.

## Merge

- `master` protegida: PR obligatoria, CI verde, rama al día, aprobación humana.
- **Squash merge**: un ticket, un commit, un revert.
- Features grandes o arriesgadas van tras un feature flag: desplegar no es activar.

## Bugfix vs hotfix

Por urgencia, no por dónde se detecta.

| Rama | Cuándo | Camino |
|---|---|---|
| `bugfix/` | Bug que no llegó a producción, o que en producción puede esperar (SEV3) | Ciclo normal |
| `hotfix/` | Bug en producción que afecta a usuarios y no puede esperar (SEV1/SEV2) | Primero apagar el flag o rollback; camino S, con los reviewers de L si toca zona crítica; prioridad máxima; **pasa por staging**; lo confirma la persona |

## Revert before fixing

`master` siempre es desplegable: ante un `master` roto se revierte antes de arreglar encima.

- Smoke de staging falla: revert en `master` si no se arregla ya, `bugfix/` y se repite. No se promueve mientras tanto.
- Fallo en producción: apagar el flag o `wrangler rollback` (no revierte datos ni esquema), luego `hotfix/` que vuelve a pasar por staging.

## Deploys

- Nunca se despliega ni migra sin `--env` explícito (`stg` / `prod`).
- `prod` es un GitHub Environment con revisor obligatorio (la persona).
- Previews por PR: aplazadas.
