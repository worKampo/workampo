---
prd: draft
title: Working foundation
status: approved
area: [platform]
---

# [PRD] Working foundation

> Estado: **aprobado (P1 y P2) el 10 nov 2026**. Implementación en pausa por decisión de la persona. La cuenta de GitHub y la identidad de git del proyecto ya están fijadas (ver "Arranque" en `decisions.md`).
> **Fichero temporal** (D52: los PRDs viven en su issue). Cuando exista el repo, este contenido pasa a ser el cuerpo de la issue `[PRD] Working foundation` y el fichero se borra.
> Este PRD aplica las **excepciones de arranque** de D35 mientras faltan sus propias piezas.

## Problem

El ciclo de trabajo diseñado (D20) no puede funcionar todavía: no hay repo, ni CI, ni entornos desplegados, ni contexto para los agentes. Cualquier ticket de producto que empecemos ahora se haría a mano, sin puntos de control, sin trazabilidad y sin forma de retomarlo si se interrumpe.

## Users

- **La persona** (product owner y revisora): necesita pedir con claridad, comprobar el resultado en local, ver el progreso y desplegar con confianza.
- **Los agentes** (orquestador y subagentes): necesitan contexto único, procedimientos ejecutables y un sitio donde dejar y leer el estado.

## Goals and metrics

| Objetivo | Métrica | Umbral |
|---|---|---|
| El ciclo completo funciona de punta a punta | Un ticket de prueba recorre Discover → Release y llega a producción | 1 ticket, sin pasos a mano fuera de los 🧑 previstos |
| Entregar es rápido | Tiempo de merge a `master` → staging desplegado | < 10 min |
| Verificar es rápido | Duración de `pnpm check` en CI | < 5 min |
| Recuperarse es rápido | Rollback de producción ensayado | < 5 min desde la decisión |
| Se puede parar y retomar | Una sesión nueva de agente continúa un ticket solo con `AGENTS.md` y `PROGRESS.md` (o el comentario "Progress" de su PR) | Sin instrucciones adicionales de la persona |
| Todo es trazable | PRs que pasan los checks de trazabilidad (D42) | 100 % desde el ticket 5 |

## Appetite

Dos semanas como máximo. Si no cabe, se recorta la automatización del ticket 5 (se hace a mano con la guía) antes que el despliegue o el contexto de agentes.

## Requirements

1. Monorepo pnpm + Turborepo + TypeScript con `pnpm check` (typecheck, Biome, dependency-cruiser, tests en workerd) en verde con tests reales; lefthook con gitleaks (D17, D18).
2. GitHub como código en un repo **público** (D43): etiquetas, plantillas de issue y PR, rulesets de `master`, Environments, CI en cada PR, GitHub App para los agentes (D13, D23, D34, D35, D41).
3. Dos entornos en workers.dev (`app-stg`, `app`) con D1 (`DB_GLOBAL`, `DB_SHARD_1`) y KV creados por script; despliegue automático a staging y con aprobación a producción; migración de todas las bases antes de desplegar; rollback ensayado (D11, D12, D13, D33).
4. Observabilidad mínima: Sentry en el Worker y monitor externo de disponibilidad (D39).
5. Contexto para agentes: `project.yaml`, `REVIEW.md`, `AGENTS.md` y adaptadores, orquestador, roles y routing, ADRs, glosario, Definition of Ready/Done, plantilla de postmortem, reglas de `PROGRESS.md`, molde de la spec viva y `docs/learnings.md` (D15, D16, D21, D22, D36, D45, D52).
6. Automatización del proceso: `pnpm work` (`inbox`, `status`, `resume`, `start`, `verify`, `pr`, `close`), `specs:ids`, `plan:check`, `plan:sync`, `test:new`, `debt`, infraestructura de `db:seed` y `db:backfill` con sus workflows, Playwright y el job E2E de CI, ventana de observación y Close automático, y checks de trazabilidad y de specs en CI (D16, D20, D29, D34, D42, D44, D52).

## Non-functional

Hereda los globales de la visión. Propios:

- **Ningún secreto en el repo** ni en logs de CI; tokens de Cloudflare con permisos mínimos, uno por entorno (D13, D41). Repo público: secret scanning y push protection activados (D43).
- **Sin licencia**: sin fichero `LICENSE`, todos los derechos reservados (D43).
- **Todo reproducible por script**: recrear un entorno desde cero no requiere más pasos manuales que los marcados 🧑. Los scripts con permisos de administración los ejecuta la persona (D35).
- **Coste cero**: planes gratuitos de Cloudflare, GitHub, Sentry, el monitor y CodeRabbit (AI review, D41).

## Solution sketch

```
workampo/                     repo worKampo/workampo; en local C:\Dev\SaaS\workampo\
  apps/
    api/                      Worker Hono: /health, página inicial y (más adelante) API, landings y Static Assets
  packages/
    db/
      schema/                 global.ts, shard.ts (Drizzle)
      migrations/             global/, shard/
      seed/                   seed determinista (D44)
      backfills/              scripts de backfill (D44)
  docs/                       product/, adr/, domains/, process/, procedures/, agents/, runbooks/, platform.md, learnings.md
  scripts/work/               pnpm work (D52)
  .github/                    workflows/, ISSUE_TEMPLATE/, pull_request_template.md, labels.yml, copilot-instructions.md
  .claude/agents/             adaptadores de roles
  .cursor/rules/              adaptador de AGENTS.md
  AGENTS.md  CLAUDE.md  GEMINI.md  GLOSSARY.md  README.md  REVIEW.md  project.yaml  .coderabbit.yaml
  package.json  pnpm-workspace.yaml  turbo.json  biome.json  .dependency-cruiser.cjs  lefthook.yml
```

- Herramientas: Biome (lint y formato) + dependency-cruiser (reglas de arquitectura) + lefthook (hooks) (D17).
- La SPA (`apps/web`) y la web corporativa (`apps/marketing`) **no** se crean aquí: llegan con los PRDs que las necesitan. Sus builds irán a los Static Assets del Worker `app` (D12).
- `wrangler.jsonc` con dos entornos; los IDs de D1/KV los rellena el script de aprovisionamiento.
- Workflows:
  - `ci.yml`: en cada PR, `pnpm check`, checks de trazabilidad y de specs (D52) y comentario "Verification". La AI review la hace la app de CodeRabbit, fuera de CI (D41).
  - `deploy.yml`: tras merge, migrar todas las bases → staging; con aprobación → producción con el mismo SHA.
  - `labels.yml`: sincroniza etiquetas.
  - `backfill.yml`: manual, con aprobación del Environment de destino (D44).
  - `reset-stg.yml`: manual, reinicia staging con el seed (D44).

## Assumptions and risks

| Tipo | Descripción | Mitigación |
|---|---|---|
| Resuelto | Protección de rama, secretos por entorno y revisores de Environments no existen en repos privados gratuitos (verificado) | Repo público (D43) y GitHub App para los agentes (D41) |
| Riesgo | `@cloudflare/vitest-plugin` es reciente (v1, agosto 2026) | Fijar versiones; el ticket 1 lo prueba con un test real |
| Riesgo | Versiones de Node/pnpm/wrangler | Fijar en `packageManager` y `.nvmrc`; Renovate (ticket 2) |
| Supuesto | El subdominio de cuenta de workers.dev puede ser el nombre del producto | Verificar disponibilidad al crear la cuenta |
| Supuesto | Sentry y un monitor externo tienen plan gratuito suficiente | El monitor se elige en el ticket 3 tras comparar límites actuales |

## Non-goals

- Ninguna funcionalidad de producto: ni login, ni empresas, ni SPA (eso es "Access and first company").
- Dominio propio.
- El Worker del backoffice (`bo`, `bo-stg`): llega con el PRD "Staff backoffice" (D48).
- Cuentas de WorkOS, Stripe o Brevo.
- Procedimientos que dependen de piezas aún inexistentes: `e2e:new`, `flaky-test.md`, `db:migration:new`, `db:lint-migrations`, `docs:new`, `changelog:new`, `docs:screenshots`.
- gitleaks en CI: entra con el primer código de producto. gitleaks en pre-commit sí entra en el ticket 1.

## Launch criteria

- Los cinco tickets en Done.
- Un ticket de prueba (cambio trivial en `/health`) ha recorrido el ciclo completo hasta producción con todos los checks: smoke, comentarios "Staging verification" y "Release verification", y Close automático tras la ventana de observación.
- Rollback ensayado y documentado en `docs/runbooks/rollback.md`.
- Una sesión nueva de agente ha retomado un ticket a partir de `PROGRESS.md`.
- `docs/platform.md` y `project.yaml` describen los entornos, pipelines y alertas reales.

## Tickets

Slicing aprobado (P2). Todos `type:chore`, con la etiqueta de apoyo `area:platform`.

| Orden | Ticket | Depende de | Modo |
|---|---|---|---|
| 1 | Repo y monorepo con `pnpm check` | — | Recorrido S sin issue previa; commits y push de la persona (D35) |
| 2 | GitHub como código | 1 | Recorrido S sin issue previa; commits y push de la persona (D35) |
| 4 | Contexto para agentes | 1, 2 | Tamaño a confirmar en la issue (D52); checklist a mano hasta el ticket 5 |
| 3 | Despliegue a staging y producción con observabilidad mínima | 2, 4 | Tamaño a confirmar en la issue (D52); checklist a mano hasta el ticket 5 |
| 5 | Automatización del proceso | 2, 3, 4 | Tamaño a confirmar en la issue (D52) |

Oleadas: 1 → 2 → 4 → 3 → 5.

**Antes del ticket 1** (🧑, ver "Arranque" en `decisions.md`): hecho el nombre (**workampo**), la cuenta de Gmail del proyecto, GitHub (`workampo-dev` y `worKampo`), Cloudflare y el gestor de contraseñas personal (Bitwarden en la región UE, D64) con lo ya creado. Con el mismo email se crean después CodeRabbit (ticket 2), Sentry y el monitor (ticket 3).

### 1 · Repo y monorepo con `pnpm check`
- **What**: repo público `worKampo/workampo` sin `LICENSE`, clonado en `C:\Dev\SaaS\workampo\`; mover ahí `docs/` desde la carpeta paraguas; configuración de Claude Code aislada del trabajo, como la de la carpeta paraguas: `.claude/settings.json` (público: exportadores de telemetría a `none`, plugins de trabajo desactivados, "deny" sobre `~/.workampo/**`) y `.claude/settings.local.json` ignorado por git (`claudeMdExcludes` con la ruta del `CLAUDE.md` global, que lleva el usuario de Windows y no puede ir al repo público, D43), más un `CLAUDE.md` mínimo hasta el ticket 4; pnpm workspaces, Turborepo, TypeScript estricto; `apps/api` con Hono y `/health`; `packages/db` con la estructura de D44 vacía; `packages/domain` (núcleo puro, D57) vacío; Vitest con `@cloudflare/vitest-plugin`; Biome + dependency-cruiser con las reglas de D53 (organización por dominio, sin ciclos, cada paquete de proveedor solo desde su adaptador, `packages/domain` sin E/S ni frameworks); lefthook con `pnpm check` y gitleaks en pre-commit; Knip en `pnpm check`; `.npmrc` / `pnpm-workspace.yaml` con `minimumReleaseAge` y `onlyBuiltDependencies` (D58); higiene del repo de D17 (`.gitattributes` con LF, `.editorconfig`, `.gitignore` completo, `tsconfig` base estricto, `.nvmrc`) y `.dev.vars.example` (D53); mismos nombres de script en todos los paquetes (D16); paquetes internos como código fuente (D18); `README.md` mínimo con el aviso de copyright de D43.
- **Why not vertical**: no hay producto todavía; es la base sobre la que se cortan los verticales.
- **Manual steps**: 🧑 crear el repo público en GitHub con la cuenta del proyecto; 🧑 configurar la identidad por carpeta (`includeIf` con el email *noreply* del proyecto, `core.hooksPath` propio, clave SSH con alias de host y `gh` con la cuenta del proyecto; ver "Arranque" en `decisions.md`) y comprobar con un commit de prueba que el autor es la cuenta del proyecto (✅ hecho el 15 nov 2026); 🧑 hacer los commits y el push (aún no existe la GitHub App).
- **Done when**: `pnpm check` en verde en local con un test de integración que llama a `/health` dentro de workerd; un commit con un secreto falso es rechazado por el hook.
- **Notas de implementación** (15 nov 2026), desviaciones a revisar en el ticket 2 con Renovate:
  - **pnpm 10.29**, no 12: el pnpm 12 nativo no arranca desde el cambio automático de versión de pnpm 10 en Windows. `onlyBuiltDependencies` es ya `allowBuilds` (pnpm ≥ 10.26) y vive en `pnpm-workspace.yaml` con `minimumReleaseAge` (3 días).
  - **TypeScript 6**, no 7: dependency-cruiser todavía no admite TypeScript 7 y con él no revisaba ningún módulo.
  - **lefthook**: el script `prepare` fija `core.hooksPath` en el propio repo antes de `lefthook install --force`; sin eso lefthook instalaría en la carpeta global de hooks de la máquina.
  - **Plugins globales de la máquina desactivados en `.claude/settings.local.json`** (ignorado por git), no en el `settings.json` público: son configuración de la máquina, no del proyecto.
  - dependency-cruiser no puede prohibir `fetch` en `packages/domain` (es global, no un import); queda para `REVIEW.md`. La regla de paquetes de proveedor llega con el primer adaptador.

### 2 · GitHub como código
- **What**: `.github/labels.yml` + sincronización (`type:*`, `area:*`, `size:*`, `sev:*`); plantillas de issue (PRD, feature, bug, chore, spike) y de PR (D34, D42); `ci.yml` con `pnpm check` en cada PR (solo en PRs, cancelando la ejecución anterior, solo lo afectado con la caché de Turborepo y jobs en paralelo, D13); AI review con la app de CodeRabbit, plan gratuito, sin tocar CI, configurada con `.coderabbit.yaml` para aplicar `REVIEW.md` (D15, D41); scripts que aplican los rulesets de `master` (PR obligatoria, CI en verde, rama al día, aprobación humana, solo squash merge), un ruleset sobre todas las ramas que bloquea el force push (D30, D41) y crean los Environments `stg` y `prod` (este con required reviewer); secret scanning, push protection y private vulnerability reporting activados; CodeQL, Dependabot (solo alertas de seguridad), Renovate (actualizaciones de versiones) y OpenSSF Scorecard (D58); tablero de GitHub Projects con las columnas de D37 y el campo "Espera a" (persona / agente); crear las issues del PRD y de los tickets 1 y 2 (rellenas con lo hecho) y de los tickets 3 a 5; crear en la columna Backlog una issue por cada cosa planificada que hoy vive fuera de GitHub: los PRDs del roadmap de `vision.md` (`type:prd`, sin cortar), lo aplazado (D46, D55, D61 y la propuesta P-1, como `type:chore` o `type:prd` según su alcance) y las comprobaciones ⚠ de `decisions.md` (Queues en el plan gratuito, MCP de WorkOS, Socket.dev; como `type:spike`). Desde ahí, el tablero es la única lista de lo planificado.
- **Why not vertical**: configuración del repositorio.
- **Manual steps**: 🧑 ejecutar los scripts de rulesets y Environments con un token de administración de un día, revocado al terminar (D64); 🧑 crear e instalar la GitHub App de los agentes (contenidos, pull requests e issues; sin administración) y guardar su clave en `%USERPROFILE%\.workampo\github-app.pem`, con copia en el gestor, sin pasarla por el chat (D64); script que obtiene tokens de instalación de 1 hora a partir de esa clave, y regla "deny" de `.claude/settings.json` sobre `~/.workampo/**`; 🧑 instalar la app de CodeRabbit en el repo (plan gratuito para repos públicos); 🧑 crear el repo privado `worKampo/business` para lo que no puede ir al repo público (D43).
- **Done when**: una PR de prueba abierta por la GitHub App con un test roto queda bloqueada; con el test arreglado y la aprobación de la persona se puede mergear solo con squash; la app no puede mergearla ni hacer push a `master`; el tablero muestra en Backlog todos los PRDs del roadmap, lo aplazado y las comprobaciones pendientes.

### 4 · Contexto para agentes
- **What**: `project.yaml` con su esquema Zod validado en `pnpm check` (D45); `AGENTS.md` (en inglés; primera instrucción: leer `PROGRESS.md`; enlaza `project.yaml`), `CLAUDE.md` (deja claro que las reglas globales de la máquina no aplican) y adaptadores (Copilot, Cursor, Gemini); `docs/agents/orchestrator.md`, los diez roles y `routing.md`, con adaptadores en `.claude/agents/`; adaptadores de procedimientos por herramienta (skills de Claude y comandos de Cursor) para los procedimientos que existan; herramientas por rol en la definición de cada agente, en solo lectura, y el orden de consulta de documentación (D58); hooks de Claude Code que impiden al implementador editar `e2e/acceptance/` y escribir algo de la lista de D43; las decisiones D1–D64 convertidas en ADRs en `docs/adr/` con índice, salvo las aplazadas D46, D55 y D61, que quedan como notas, y su detalle operativo en documentos vivos de `docs/process/`; `GLOSSARY.md`; `docs/process/code-conventions.md` (D53), enlazado desde `AGENTS.md`; `REVIEW.md` con la política de revisión de PRs (D15); la lista "No entra" del repo público en `AGENTS.md` y `REVIEW.md`, con la parada obligatoria y el aviso del disparador (D43); plantillas del intent (cuerpo de la issue), `plan.md` y `tasks.md`; molde de la spec viva y `docs/domains/` con los cuatro dominios (`access`, `companies`, `billing`, `public-site`) (D52); `docs/learnings.md` y la instrucción de `AGENTS.md` de leerlo; `docs/process/` (ciclo, branching, Definition of Ready, Definition of Done, plantilla de postmortem); `docs/procedures/progress.md` y `traceability.md`; `vision.md` en su sitio final y `decisions.md` retirado (sustituido por el índice de ADRs).
- **Why not vertical**: contexto del proceso.
- **Manual steps**: ninguno.
- **Done when**: cada ADR enlaza desde el índice y desde `AGENTS.md` donde aplique; una sesión nueva de agente retoma el trabajo correcto sin más instrucciones tanto en una rama con `PROGRESS.md` como en una con PR abierta y comentario "Progress"; el orquestador y los diez roles tienen definición neutral y adaptador.

### 3 · Despliegue a staging y producción con observabilidad mínima
- **What**: `wrangler.jsonc` con entornos `app-stg` y `app`; script que crea D1 (`DB_GLOBAL`, `DB_SHARD_1`) y KV por entorno, con los nombres de D13 (`global-stg`, `shard-1-prod`…) y D1 siempre con `--jurisdiction eu` (falla sin ella, D63); `deploy.yml` (migrar todas las bases de `d1_databases` → desplegar solo los Workers afectados desde el SHA que ya está en el entorno, calculados con Turborepo; producción calcula su propio diff contra sus SHA desplegados, hasta el SHA ya validado en staging; staging automático tras merge; producción con aprobación y el mismo SHA; `concurrency`; mensaje de versión `#<PR> <sha>`) y workflow manual "desplegar todo" (D60); `/health` devuelve el SHA desplegado; los logs registran `X-Client-Version` si llega, y el middleware que añadirá `X-App-Version` (hash del build de la SPA) queda preparado para cuando exista la SPA (D59); pipeline de assets: los builds de `apps/web` y `apps/marketing`, cuando existan, van a los Static Assets del Worker `app` (D12); smoke de staging (ejemplos de la spec) y de producción (solo lectura) tras cada despliegue, contra todos los Workers, que publica los comentarios "Staging verification" y "Release verification" en la issue con lo desplegado y su SHA (D20, D29, D60); Sentry con release = SHA y source maps subidos a Sentry y borrados antes del despliegue, con un check que falla si quedan `.map` (D43); monitor externo sobre `/health` cada 5 minutos (D48); verificar si las peticiones a Static Assets cuentan en el cupo diario; runbooks de despliegue y rollback; `docs/platform.md`; datos reales de staging y producción en `project.yaml` (D45).
- **Why not vertical**: infraestructura de entrega.
- **Manual steps**: cuenta de Cloudflare y subdominio `workampo.workers.dev` ya hechos en el arranque; 🧑 ejecutar el script de aprovisionamiento con su token; 🧑 crear los tokens de API por entorno y guardarlos como secretos de los Environments `stg` y `prod`; 🧑 crear la organización de Sentry **en la región UE** (no se puede cambiar después, D63), con la limpieza de datos personales activada, y el monitor; 🧑 aprobar el primer despliegue a producción.
- **Done when**: tras un merge, `app-stg.workampo.workers.dev/health` muestra el SHA en menos de 10 min y el smoke publica "Staging verification" en la issue; tras aprobar, `app.workampo.workers.dev/health` muestra el mismo SHA; un rollback ensayado vuelve al SHA anterior en menos de 5 min; un error de prueba aparece en Sentry con su release; el monitor avisa si `/health` cae; un merge que solo toca documentación no despliega ningún Worker y uno que toca `packages/domain` despliega todos sus consumidores.

### 5 · Automatización del proceso
- **What**: `pnpm work` en `scripts/work/`: sin argumentos muestra la ayuda y el siguiente paso; `inbox` (lo que espera a la persona: momentos 1, 2 y 3 y paradas abiertas, con enlaces), `status`, `resume`, `start`, `verify`, `pr` y `close` (D52: repetibles, `--dry-run`, sin credenciales propias); todos comprueban que `gh` y el autor de git son la cuenta del proyecto de `project.yaml`, y `start` se niega sin etiqueta `size:`; `pnpm specs:ids` (`@id` estables en los ejemplos de las specs vivas); `pnpm plan:check` (dependencias, ciclos, solapes de ficheros por oleada) y `pnpm plan:sync` (checklist `- [ ]` / `- [x]` en la issue desde `tasks.md`); `pnpm test:new`; `pnpm debt` (lista las marcas `paid-plan`, D56); Playwright y el job E2E de CI (D29; lo necesitan los escenarios de aceptación y `pnpm work verify`); ventana de observación de la Release (comprobación programada que lanza al verificador; duración en el runbook de despliegue) y Close automático con `pnpm work close`, sin preguntas (D20); infraestructura de `pnpm db:seed` (determinista, idempotente, bloqueada en producción) y de `pnpm db:backfill`; workflows `backfill.yml` y `reset-stg.yml` (D44); checks de CI: nombre de rama, commitlint con trailers `Refs`/`PRD`/`Task`, cuerpo y etiquetas de la PR, sin `@wip` ni temporales (`PROGRESS.md`, `plan.md`, `tasks.md`) en lo que llega a `master`, cada ejemplo con su test (y ningún test de un ejemplo inexistente), escenarios de aceptación protegidos (commits de `e2e/acceptance/` antes que cualquier commit fuera de `docs/**`, `PROGRESS.md`, `plan.md` y `tasks.md`, salvo `/reopen-acceptance` de la persona, D30), etiqueta `size:` y `size:L` si el diff toca rutas de zona crítica (lista en `docs/procedures/critical-paths.md`), autor de los commits con el email *noreply* del proyecto, ningún email en el diff fuera del dominio de prueba del seed y del *noreply* (D43), aviso de código duplicado en `.tsx` (jscpd, D53), formato de las marcas `paid-plan` (D56), y comentario "Verification" generado; guías `work.md`, `critical-paths.md`, `living-specs.md`, `planning.md`, `testing.md`, `seeds.md` y `backfills.md`.
- **Why not vertical**: herramientas del proceso.
- **Manual steps**: ninguno.
- **Done when**: `db:seed` se niega a ejecutarse con configuración de producción (test en CI); `plan:check` rechaza un `tasks.md` con un ciclo y otro con dos tareas paralelas que tocan el mismo fichero (tests); `plan:sync` actualiza la checklist de una issue real; `pnpm work start` y `pnpm work pr` llevan un ticket de prueba de la issue a la PR sin pasos a mano; `pnpm work verify` deja un ticket de prueba listo para comprobar en el navegador con un solo comando; una PR sin trailer `Refs:`, con `PROGRESS.md`, con `@wip`, con un ejemplo sin test o con un commit de `e2e/acceptance/` después de código falla en CI; la ventana de observación de un ticket de prueba lo cierra sin intervención.
