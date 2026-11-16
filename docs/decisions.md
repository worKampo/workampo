# Registro de decisiones — SaaS base multitenant (Cloudflare)

> Estado: **borrador de diseño, v3** (última revisión completa: 12 nov 2026, D52; añadidas D53 y D54 el 13 nov 2026 y D55 (aplazada), D56 a D64 el 14 nov 2026).
> Fuente: revisión de `saas.md` (spec v6.0) entre persona y agente. Cada decisión se convertirá en un ADR en `docs/adr/` (o en un ADR + documento vivo de proceso) en el ticket 4 del PRD "Working foundation".
> Visión, política de idioma, requisitos no funcionales globales y roadmap: [`docs/product/vision.md`](product/vision.md).

## Cómo leer este documento

- **Decisión**: lo acordado. **Por qué**: la razón. **Resuelve**: sección (§) del spec original que corrige o aclara.
- Términos técnicos en inglés según la política de idioma de la visión (D36).
- Nada que no esté aquí está decidido.

---

## Producto y alcance

### D1 — Producto: base SaaS genérica
- **Decisión**: `companies`, `users` y `members` (membresías). Sin lógica de negocio.
- **Por qué**: sobre esta base se montará cualquier negocio, incluso distintos por empresa. El modelo no debe impedirlo, pero no se implementa nada para ello ahora.

### D2 — Alcance de la v1: web + D1
- **Entra**: API Hono, D1, web app, backoffice, auth con WorkOS, Stripe, landings de empresa, web corporativa, ayuda, changelog y páginas legales.
- **Aplazado** (cada uno con su ADR cuando toque): app móvil y sync offline (la base se prepara para ella desde ya, D57), Postgres, Tinybird / IA / búsqueda vectorial, webhooks salientes, dominios personalizados, rate limiting. El trabajo asíncrono se diseña ahora y se construye con su primer caso real (D56).
- **Por qué**: el spec describe varios productos a la vez; un esquema dual SQLite + Postgres duplica el coste de cada cambio.
- **Resuelve**: §5, §7, §8, §13, §32, §34, §39.

### D3 — Documentación en el repo
- **Decisión**: `docs/` versionado junto al código; ADRs numerados en `docs/adr/` (plantilla MADR).

---

## Tenancy, routing y sesión

### D4 — Landings renderizadas en el Worker
- **Decisión**: las secciones son componentes JSX de Hono. Al guardar, el Worker renderiza el JSON de la empresa a HTML y lo guarda en KV. Las secciones ocultas no se emiten.
- **Por qué**: `astro build` no puede ejecutarse dentro de un Worker; las regex sobre HTML son frágiles.
- **Consistencia**: KV propaga en 60 s o más. El editor muestra el HTML que devuelve la API al guardar, nunca lo relee de KV. Los visitantes pueden ver la versión anterior durante ese tiempo; se acepta.
- **Límite**: KV Free admite 1.000 escrituras/día en toda la cuenta (una por guardado). Suficiente para la beta.
- **Resuelve**: contradicción §4.2 (Astro build) vs §4.5 (regex).

### D5 — `resolveTenant()` dual por configuración
- **Decisión**: una sola función `resolveTenant()` con modo por entorno (`TENANT_ROUTING`):
  - `path` (sin dominio propio, workers.dev): la empresa va en la ruta.
  - `subdomain` (con dominio propio): la empresa es el subdominio.
- Siempre se valida la membresía. Nunca se confía en un header enviado por el cliente.
- **En la base solo se guarda el slug**, nunca un host ni una URL. El host se deduce y se construye con la configuración del entorno (`TENANT_ROUTING`, `TENANT_HOST_SUFFIX`, `PUBLIC_BASE_URL`):
  - `resolveTenant(request)`: host o ruta → slug (`acme-stg.workampo.com` → `acme`).
  - `tenantUrl(slug, path)`: slug → URL absoluta del entorno. Es la única forma de generar enlaces (emails, redirecciones, canonical, sitemap, SPA).
  - Cada entorno tiene su propia base: la `acme` de staging es otra empresa, no una copia.
  - Excepción futura: dominios personalizados, donde el hostname sí es un dato (tabla hostname → empresa).
- Ambos modos con tests desde el principio, incluido `tenantUrl()` con cada combinación de configuración.
- **Por qué**: workers.dev no admite subdominios wildcard (verificado) y ningún hostname gratuito de Cloudflare lo hace.
- workers.dev está en la Public Suffix List: las cookies no se comparten entre Workers, así que producción y staging quedan aislados sin hacer nada.
- **Resuelve**: §8 (`X-Tenant-ID` sin validar).

### D6 — Mapa de rutas en el mismo origen
| Modo | Landing | App (SPA) | API |
|---|---|---|---|
| `path` | `/l/:slug` | `/c/:slug/*` | `/api/t/:slug/*` |
| `subdomain` | `acme.dominio/` | `acme.dominio/app/*` | `acme.dominio/api/*` |

- Mismo origen para landing, app y API: sin CORS. La SPA calcula su ruta base al arrancar (`/c/:slug` en modo path, `/app` en modo subdomain).
- **Backoffice en su propio Worker y su propio host**, separado de la app por seguridad (D48): `bo.workampo.workers.dev` / `bo-stg.workampo.workers.dev` sin dominio; `bo.workampo.com` / `bo-stg.workampo.com` con dominio. El modo subdomain solo se usa para empresas.
- Marketing en `/` (modo path) o en el apex (modo subdomain). Login en `/login`. Ayuda en `/docs` (D25). Legal en `/legal/*` (D27).
- **Resuelve**: §2.1.

### D7 — Login central
- **Decisión**: login en `/login` del host central. Tras autenticar: una empresa → redirección directa; varias → selector.
- En modo `subdomain`, la sesión pasa al subdominio con un **código de un solo uso**: vida ≤ 60 s, guardado en `DB_GLOBAL`, invalidado al canjearse. `return_to` solo admite hosts del propio entorno (evita open redirect).
- En modo `path` el login no necesita canje: todo está en el mismo host. El canje se construye igualmente en ambos modos: lo necesita el salto backoffice → app de "Enter as" (D50).
- El mismo canje servirá para dominios personalizados futuros.
- **Punto de entrada**: la landing corporativa. "Sign in" y "Get started" llevan a `/login`, una **página propia con aspecto de modal** (tarjeta centrada sobre fondo neutro, cierre que vuelve a la landing), no un modal dentro de la landing:
  - el campo de contraseña nunca comparte página con scripts de terceros (analítica, chat); `/login` lleva CSP estricta y cero scripts de terceros (D32);
  - los enlaces de email, la sesión caducada y `return_to` necesitan una URL de login de todas formas;
  - la landing sigue siendo Astro estático sin el código de auth (Lighthouse, D31).
- **Nunca un formulario de login en una landing de empresa** (contenido escrito por la empresa, D32): su "Sign in" lleva al login central con `return_to`.
- **Resuelve**: §3, §4.4 vs §39.

### D8 — Sesión propia en D1, cookie host-only
- **Decisión**: WorkOS solo autentica. Emitimos un session ID aleatorio guardado en `DB_GLOBAL` (expiración y revocación) y lo enviamos en una cookie `__Host-` (sin atributo Domain), `HttpOnly`, `Secure`, `SameSite=Lax`. Ningún token en `localStorage`.
- **Por qué**: revocación instantánea (logout global, expulsión, baja de empresa); sin robo por XSS; las cookies de producción no viajan a staging; no dependemos de que los helpers de sesión sellada de WorkOS funcionen en workerd (no confirmado).
- La app móvil (aplazada) usará `Authorization: Bearer` contra la misma tabla de sesiones. Un único middleware resuelve la sesión desde la cookie o la cabecera; ahora solo se implementa la cookie (D57).
- **WorkOS solo como identidad** (13 nov 2026): verifica quién es la persona y nada más. Empresas, miembros, roles e invitaciones viven en nuestra base de datos, que es la fuente de verdad. No se usan Organizations, memberships ni roles de WorkOS, ni se reflejan en D1 por webhooks. El usuario se crea en `DB_GLOBAL` en su primer login. La baja de una cuenta la gestiona nuestro flujo (D27), que también la elimina en WorkOS. Lección del proyecto anterior: tener WorkOS como fuente de verdad obligó a doble escritura no atómica y a parches por eventos fuera de orden.
- **Resuelve**: §22.

### D9 — Catálogo, flags y sesiones solo en D1
- **Decisión**: `DB_GLOBAL` es la única fuente de verdad del catálogo de empresas, los feature flags y las sesiones.
- **Consistencia en v1**: sin read replicas; sin `withSession`, todas las consultas van a la primaria y lo recién escrito se lee siempre.
- Read replicas + Sessions API siguen en beta pública; se activarán como optimización, con su ADR, cuando la latencia lo justifique.
- KV solo guarda el HTML renderizado de las landings.
- **Resuelve**: contradicción §2.4 (D1) vs §6/§8 (KV).

### D10 — `DB_SHARD_1` desde la v1
- **Decisión**: los datos propios de cada empresa van al shard desde el primer día. Enrutado empresa → shard en `DB_GLOBAL`.
- **Aislamiento**: D1 no tiene RLS. El filtro `tenant_id` se aplica en una capa de acceso a datos obligatoria, con reglas de lint que impiden saltársela (D17) y la suite de aislamiento (D29).
- **Por qué**: añadir sharding después es caro; así el mecanismo está probado desde el inicio.
- Los bindings D1 son estáticos: un shard nuevo requiere redesplegar.
- **Regla de diseño**: D1 no tiene transacciones interactivas. Lo que deba ser atómico cabe en un único `batch()`. No hay atomicidad entre `DB_GLOBAL` y un shard.
- **Sin claves foráneas entre bases** (13 nov 2026): las relaciones entre `DB_GLOBAL` y un shard (p. ej. `tenant_id` → empresa) son solo identificadores; las claves foráneas y los `ON DELETE CASCADE` existen únicamente dentro de una misma base. Los borrados que cruzan bases los hace la aplicación o un proceso idempotente y reintentable (p. ej. la purga de una empresa, D27).
- **Shard Postgres en el futuro** (13 nov 2026): posible más adelante para empresas que lo necesiten, conectando el Worker vía Hyperdrive; se decide con su propio ADR. Para que el cambio quede acotado, el código sigue desde ya las reglas de portabilidad de D53.
- **Límites Free**: 500 MB por base, 10 bases, 5 GB por cuenta, 5M filas leídas y 100k escritas al día. Paid: 10 GB por base.
- **Resuelve**: §1.

---

## Infraestructura y entornos

### D11 — Entornos sin coste de dominio extra
- **Sin dominio propio**: cada entorno es su propio Worker en workers.dev. El formato es fijo, `<worker>.<subdominio de cuenta>.workers.dev`: el subdominio de cuenta lleva el nombre del producto y los Workers se llaman `app` y `app-stg` (`app.workampo.workers.dev`, `app-stg.workampo.workers.dev`).
- **Con dominio propio**: staging usa sufijo en la etiqueta dentro del mismo dominio:

| | Producción | Staging |
|---|---|---|
| Empresa | `acme.workampo.com` | `acme-stg.workampo.com` |
| Marketing / login | `workampo.com` | `stg.workampo.com` |
| Backoffice (Worker propio, D48) | `bo.workampo.com` | `bo-stg.workampo.com` |

- El slug se obtiene quitando un sufijo configurado por entorno. Ningún slug puede terminar en `-stg`.
- Rutas del Worker: `*.workampo.com/*` **y** `workampo.com/*` (el wildcard no incluye el apex) con un registro DNS wildcard proxied. Los Custom Domains de Workers no admiten wildcard.
- **Por qué**: Universal SSL (gratis) cubre el apex y un nivel; un segundo nivel exige Advanced Certificate Manager, de pago.
- **Resuelve**: §2.1.

### D12 — Workers + Static Assets, sin Pages
- **Decisión**: el Worker `app` sirve landing (KV), SPA, marketing y ayuda (Static Assets) y API en un único despliegue. El backoffice es un segundo Worker (`bo`, D48) sobre las mismas bases D1.
- Los builds de `apps/web` (SPA) y `apps/marketing` (web corporativa y ayuda) se copian a los Static Assets del Worker `app`.
- **Por qué**: Pages no admite dominios wildcard; el wildcard necesita un Worker de todas formas. API y SPA salen siempre en la misma versión y el rollback es uno solo.
- Assets gratuitos e ilimitados; 20.000 ficheros por versión en Free, 25 MiB por fichero. `run_worker_first` decide qué rutas pasan antes por el Worker.
- **Resuelve**: §2.1, §17.1.

### D13 — CI/CD con GitHub Actions
- Se ejecuta en cada PR (no solo en push).
- **CI rápido** (14 nov 2026): el tiempo de espera importa más que el coste (los minutos son gratis en un repo público, D43).
  - Solo en PRs (`on: pull_request`): subir una rama sin PR, como copia de seguridad, no lanza nada. CI arranca con `pnpm work pr`.
  - `concurrency` con `cancel-in-progress` por PR: con dos pushes seguidos solo cuenta el último.
  - Solo lo afectado: tests, typecheck y lint de los paquetes y apps que cambiaron, con la caché de Turborepo en Actions. Sin cambios en apps, no hay E2E; con cambios, solo los E2E y escenarios de aceptación de esas apps (D29).
  - Jobs en paralelo: checks rápidos (lint, tipos, unitarios e integración) y E2E por separado; los E2E se reparten en varias máquinas si crecen.
  - Primero en local: el hook pasa `pnpm check` de lo afectado y el agente ejecuta los E2E antes de `pnpm work pr`. CI confirma, no descubre.
  - Revisión de la PR: el agente agrupa los arreglos de cada ronda (comentarios de CodeRabbit, de CI o hallazgos del momento 2) y hace **un push por ronda**. El merge *squash* (D23) deja un solo commit en `master`.
  - Objetivo: respuesta de CI en una PR en menos de unos 10 minutos, medido en D40. Si se supera, se mide qué parte tarda antes de cambiar nada.
- Migra **todas** las bases D1 del entorno antes de desplegar (D33).
- Cubre todas las apps, no solo la API; cada despliegue incluye solo los Workers afectados desde lo que ya está en el entorno (D60).
- Producción protegida con GitHub Environments: `prod` con **required reviewer** (la persona) y secretos por entorno; tokens de Cloudflare con permisos mínimos, uno por entorno. Disponible porque el repo es público (D43).
- **Nombres de los entornos** (14 nov 2026): en todo identificador técnico, `stg` y `prod`, siempre explícitos (entornos de `wrangler.jsonc` y `--env`, GitHub Environments, claves de `project.yaml`, nombres de workflows). Los recursos internos de Cloudflare se llaman `<recurso>-<entorno>`: `global-stg` / `global-prod`, `shard-1-stg` / `shard-1-prod`, `landings-stg` / `landings-prod`, `files-stg` / `files-prod`. Excepción: los Workers de producción van sin sufijo (`app`, `bo`) porque su nombre es su URL pública; los de staging son `app-stg` y `bo-stg` (Wrangler añade el sufijo del entorno solo; en `prod` se fija el nombre). En el texto se sigue diciendo "staging" y "producción". Un nombre sin entorno parecería el valor por defecto, que es la trampa que evita la regla siguiente.
- `concurrency` para que dos despliegues no migren a la vez.
- **Despliegue seguro** (13 nov 2026): nunca se despliega ni se migra sin `--env` explícito; la configuración base de `wrangler.jsonc` (sin entorno) no apunta a recursos de producción, y los scripts de despliegue fallan si falta el entorno. En el proyecto anterior, un `deploy` sin entorno podía sobrescribir el Worker de producción con otra base.
- Node LTS vigente; versión de pnpm fijada en `packageManager`.
- Rollback: `wrangler rollback` a cualquiera de las 100 últimas versiones; no revierte datos ni esquema (por eso D33).
- Workers Builds (CI nativa) se descarta: seguimos con GitHub Actions por los checks en PR, la migración de varias bases y la aprobación de producción.
- **Resuelve**: §43–44.

### D14 — Comprar dominio = cambiar configuración
- Pasar de workers.dev a dominio propio solo cambia rutas, `TENANT_ROUTING` y sufijos. Runbook en `docs/runbooks/`.
- **Cuándo comprarlo** (14 nov 2026): antes de tener clientes reales. Es el primer gasto real y uno de los disparadores para salir del "0 € en etapas preliminares", junto al de pasar el repo a privado (D43). Sin dominio, Brevo sustituye un remitente `@gmail.com` por una dirección `@brevosend.com`: llega, pero con un remitente ajeno y más riesgo de spam. Sirve para desarrollo, staging y primeros usuarios de prueba.
- **Correo por etapas**:

| Etapa | Correo | Coste |
|---|---|---|
| Ahora, sin dominio | Gmail del proyecto; la app envía con Brevo desde `@brevosend.com` | 0 € |
| Con dominio, antes de clientes | Cloudflare Email Routing reenvía las direcciones del dominio al Gmail; Gmail responde con "Enviar como" (SMTP de Brevo); Brevo envía `notifications@` con el dominio autenticado | Solo el dominio |
| Con clientes de pago | Google Workspace Business Starter con un usuario (unos 6,80 €/mes con compromiso anual u 8,10 € mensual; confirmar al contratar); las direcciones públicas pasan a ser alias o grupos, gratis dentro del plan; Brevo sigue enviando lo de la app | Unos 7–8 €/mes |

- **Direcciones del dominio** (en inglés, como el idioma por defecto, D47; sin catch-all):

| Dirección | Para qué |
|---|---|
| `notifications@` | Remitente de los emails de la app, con `Reply-To: support@`. Sin `no-reply@`: las respuestas de los clientes son información útil |
| `hello@` | Contacto general (web corporativa) |
| `support@` | Ayuda y respuestas a las notificaciones |
| `billing@` | Contacto de facturación y email de la cuenta de Stripe |
| `privacy@` | Peticiones de datos personales (D27) |
| `security@` | Avisos de vulnerabilidades, además del reporte privado de GitHub (D32) |
| `dmarc@` | Informes de DMARC |
| `abuse@`, `postmaster@` | Las que los estándares esperan en todo dominio |

  - Todas llegan al Gmail del proyecto (o al usuario de Workspace), separadas con filtros por destinatario y etiquetas; se responde eligiendo el remitente. Newsletters futuras, en un subdominio aparte (`news.`) para no afectar a la reputación de los transaccionales.
  - DNS: un solo registro SPF con Cloudflare y Brevo; DKIM de Brevo; DMARC primero en `p=none` con informes a `dmarc@` y, cuando salgan limpios, `quarantine`.
  - Las direcciones son públicas por diseño y se declaran en `project.yaml` (D45).
- **Las cuentas del proyecto siguen con el Gmail gratuito** ("Arranque"), sobre todo Cloudflare: es la llave de emergencia si el dominio o el correo fallan, también con Workspace.
- **Brevo por entorno**: una cuenta gratuita aparte para staging, con su propia clave, para no gastar el cupo diario de producción (unas 300 emails al día compartidas entre marketing y transaccionales; confirmar en la página de precios de Brevo).

### Valores por defecto
- Backoffice en su propio Worker y host (D6, D48); staff autenticado por WorkOS con rol en `DB_GLOBAL`.
- Slugs reservados: `www`, `app`, `api`, `admin`, `bo`, `stg`, `staging`, `prod`, `mail`, `docs`, `legal`, `l`, `t`, `c`…
- Web corporativa con Astro estático.

---

## Plataforma de desarrollo

### D15 — Contexto para agentes, multi-herramienta
- `AGENTS.md` es la fuente única (arquitectura, comandos, convenciones, enlaces a ADRs). En inglés (D36). Su primera instrucción: si existe `PROGRESS.md` en la rama, o un comentario "Progress" en su PR abierta, empezar por ahí (D16).
- `CLAUDE.md` solo importa `@AGENTS.md` y añade lo exclusivo de Claude.
- Adaptadores mínimos para otras herramientas (`.github/copilot-instructions.md`, `.cursor/rules`, `GEMINI.md`) que apuntan a `AGENTS.md` sin copiar contenido.
- `AGENTS.md` por paquete solo cuando tenga reglas propias.
- **El contexto de agentes solo describe lo que existe** (13 nov 2026): sin fragmentos de código copiados (enlaza al fichero real) ni planes futuros; CI comprueba que existen las rutas que nombran `AGENTS.md` y sus adaptadores. Lección del proyecto anterior: sus `CLAUDE.md` describían carpetas inexistentes y esquemas ya cambiados.
- `README.md` para personas.
- **`REVIEW.md`** en la raíz: la **política de revisión** de PRs (convención del AI-native SDLC playbook de Anthropic). Define las pasadas (bugs, seguridad con la checklist de D32, cumplimiento contra el intent de la issue, el diff de la spec viva y `plan.md` si existe, UI/UX contra D31), qué es *Important* y qué es *Nit*, y qué ignorar. La aplican el spec reviewer, el security reviewer y la AI review en CI; sus hallazgos no aprueban ni bloquean por sí solos: aprueba la persona. Excepción: un hallazgo de la lista "No entra" (D43) es un fallo que hay que resolver. En inglés.
- **Piezas de cada ticket** (D52), con nombres alineados con el playbook: intent (cuerpo de la issue), change spec (diff de la spec viva), `plan.md` (solo L) y nuestro `tasks.md`, temporales en la rama; la verificación es el comentario "Verification" que genera CI (nombre distinto de `REVIEW.md`). El nivel PRD (D34) es nuestro: el playbook no lo tiene.

### D16 — Harness de procedimientos
- Cada procedimiento = **script ejecutable** (`pnpm …`) + **guía neutral** en `docs/procedures/<name>.md` (cuándo, orden, qué comprobar, qué no hacer). En inglés.
- Enlazados desde `AGENTS.md`; adaptadores finos por herramienta (skills de Claude, comandos de Cursor).
- Se añaden sobre la marcha: una tarea repetida a mano se convierte en procedimiento.
- **Mismos nombres de script en todos los paquetes** (13 nov 2026): `dev`, `build`, `test`, `typecheck`, `lint`; Turborepo los encadena en `check`. `lint` es siempre el linter (Biome), nunca un alias de `tsc`.
- **Catálogo inicial**:

| Comando | Guía | Para qué |
|---|---|---|
| `pnpm check` | — | typecheck + lint + tests (D17) |
| `pnpm work [inbox\|status\|resume\|start\|verify\|pr\|close]` | `work.md` | ciclo del ticket sin pasos manuales: lo que espera a la persona, estado, retomar, empezar, comprobar en local, abrir la PR, cerrar (D52) |
| `pnpm debt` | — | lista las marcas `paid-plan` (D56) |
| — | `critical-paths.md` | rutas de zona crítica que exigen `size:L` (D52) |
| `pnpm specs:ids` | `living-specs.md` | asigna `@id` estables a los ejemplos de las specs vivas (D52) |
| `pnpm plan:check` | `planning.md` | valida dependencias, ciclos y solapes en `tasks.md` (D20) |
| `pnpm plan:sync` | — | escribe las tareas de `tasks.md` como checklist en la issue (D34) |
| `pnpm db:migration:new --global\|--shard [--data]` | `db-migrations.md` | nueva migración: de esquema (envuelve `drizzle-kit generate`) o de datos de referencia (`--data`, envuelve `drizzle-kit generate --custom`); añade las cabeceras de D33 y D42 (D44) |
| `pnpm db:lint-migrations` | `db-migrations.md` | bloquea contracciones no autorizadas (D33) |
| `pnpm test:new` | `testing.md` | plantilla de test de integración con seed y `fetch` simulado (D29) |
| `pnpm e2e` | `e2e.md` | ejecuta los E2E contra `wrangler dev` (D29) |
| `pnpm e2e:new` | `e2e.md` | plantilla Playwright con `data-testid` y login falso (D29) |
| — | `flaky-test.md` | diagnóstico de tests inestables: traza, nunca `sleep`, cuarentena con issue y fecha límite |
| `pnpm docs:new` | `help-article.md` | guía de ayuda en Starlight (D25) |
| `pnpm changelog:new` | `changelog-entry.md` | entrada de changelog con `draft` según flag (D26) |
| `pnpm docs:screenshots` | `help-article.md` | regenera capturas con Playwright y seed fijo (D28) |
| `pnpm db:seed` | `seeds.md` | datos deterministas para local, test y staging; nunca producción (D44) |
| `pnpm db:backfill <name>` | `backfills.md` | ejecuta un backfill por lotes; en entornos remotos solo vía workflow manual aprobado (D44) |
| — | `progress.md` | formato y reglas de `PROGRESS.md` (ver abajo) |
| — | `traceability.md` | formatos exactos de trazabilidad (D42) |
| — | `REVIEW.md` (raíz) | política de revisión de PRs para revisores humanos, agentes y AI review (D15) |

- **`PROGRESS.md`: estado actual del trabajo en curso**, para poder parar en cualquier momento y retomar.
  - Uno por rama de ticket (de cualquier tamaño, D52), en la raíz del repo. El ciclo de un PRD (P1–P3, D34) no tiene rama: su estado va en un comentario "Progress" de la issue del PRD. Se **sobrescribe**: solo el paso actual, sin historial (el historial está en git y la issue).
  - Lo actualiza el orquestador en cada paso hasta Document (paso 7), al terminar cada oleada y siempre antes de parar. Se commitea en la rama para que sobreviva a cambios de máquina, sesión o herramienta.
  - **El estado cambia de sitio según la fase**, siempre con el mismo formato y sobrescrito:

| Fase | Dónde vive el estado |
|---|---|
| Hasta Document (pasos 1–7) | `PROGRESS.md` en la rama |
| Pull request (paso 8) | Un único comentario **"Progress"** en la PR, que el orquestador edita. `pnpm work pr` copia ahí el contenido y borra los temporales en el mismo commit |
| Staging y Release (pasos 9–10) | Comentarios de la issue (D20) |

  - **Temporales de rama**: `PROGRESS.md`, `plan.md` y `tasks.md`; reglas en D52.
  - Al empezar una sesión, el agente lee `AGENTS.md` → `PROGRESS.md` o, si la rama tiene una PR abierta, su comentario "Progress" → la issue → `tasks.md` y `plan.md` si existen, y continúa desde "Next". `pnpm work resume` imprime ese resumen.
  - Formato:
    ```markdown
    # Progress
    PRD #12 · Ticket #15 invite-by-email · Branch: feature/15-invite-by-email
    Step: Build › Implement · wave 2 of 3
    Done in this step: T1, T2
    In progress: T3, T4
    Next: pnpm check after wave 2, then T5
    Waiting for human: —
    Open questions: —
    Updated: 2026-11-10 10:42
    ```

### D17 — Harness verificable
- `pnpm check` (typecheck + lint + tests) es el único criterio de terminado de una tarea u oleada: local, pre-commit y CI. El de un ticket es la Definition of Done (D34).
- Tests dentro de workerd con D1/KV locales: `@cloudflare/vitest-plugin` (antes `vitest-pool-workers`), Vitest ≥ 4.1. Migraciones en tests con `applyD1Migrations()`.
- Lint y formato con **Biome**; reglas de arquitectura con **dependency-cruiser** (p. ej. una ruta no importa D1 directamente; `packages/*` no importa de `apps/*`).
- Hooks de git con **lefthook**: `pnpm check` y gitleaks en pre-commit. Los tests de la primera oleada van como fallos esperados (`it.fails`) y los escenarios de aceptación no corren en pre-commit (D20, D30).
- **Higiene del repo** (13 nov 2026):
  - **Un solo formateador**, Biome, obligatorio en todo el repo (formato comprobado en `pnpm check`).
  - **Finales de línea LF**: `.gitattributes` con `* text=auto eol=lf` y `.editorconfig` (LF, UTF-8, sangría de 2 espacios). Excepción explícita para este repo a la preferencia general de CRLF de la persona: el código corre en Workers y CI de Linux.
  - **`.gitignore` completo desde el inicio**: `node_modules/`, `*.tsbuildinfo`, `.turbo/`, `.wrangler/`, `dist/`, `.dev.vars*` salvo `.dev.vars.example`, `.env*` salvo `.env.example`, `playwright-report/`, `test-results/`, `coverage/`.
  - **TypeScript estricto**: `strict` más `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride` y `verbatimModuleSyntax` en el `tsconfig` base.
  - **Versión de Node fijada** en `.nvmrc` y `engines`, y de pnpm en `packageManager`.

### D18 — Turborepo y generadores
- `turbo run` para el grafo de tareas y la caché del monorepo.
- `turbo gen` implementa los generadores del catálogo de D16 (`docs:new`, `changelog:new`, `db:migration:new`, `test:new`, `e2e:new`).
- **Los paquetes internos se consumen como código fuente** (13 nov 2026): ningún paquete del monorepo tiene build propio; sus `exports` apuntan a TypeScript y cada app lo compila. Así no hace falta construir paquetes antes de testear o desarrollar.

### D19 — Contrato tipado con Hono RPC
- Cliente `hc` de Hono: tipos de extremo a extremo entre API y SPA sin generar código.
- OpenAPI (`@hono/zod-openapi`) cuando haya consumidores externos.
- **La API solo evoluciona añadiendo** (14 nov 2026): quitar o cambiar el significado de un campo o endpoint exige un periodo de transición, porque una app móvil instalada seguirá llamando con su versión vieja (D57). Trabajo largo: `202` + `GET /api/t/:slug/jobs/:id`; `Idempotency-Key` en los `POST` que crean algo (D56). Cabeceras de versión `X-Client-Version`, `X-App-Version` y, solo en emergencias, `X-Min-Client-Version` (D59).

---

## Producto y proceso

### D20 — Ciclo de vida de un ticket
Inspirado en spec-driven development (GitHub Spec Kit, Kiro): **spec → plan → tasks → implement**. Revisada el 14 nov 2026: **la persona interviene en tres momentos**, iguales para todos los tamaños; entre ellos el agente trabaja solo y únicamente para en los casos de la lista cerrada de "Paradas obligatorias". La persona define y comprueba resultados; no revisa todo el código.

| Momento 🧑 | Cuándo | Qué hace la persona | Qué recibe |
|---|---|---|---|
| **1. Pedir** | PRD y slicing (D34); en tickets sueltos, al crear la issue | Conversa con el agente hasta que todo es concreto. Aprueba la lista de tickets con su tamaño y **los ejemplos de todos los tickets de una vez** | PRD, tickets y, por ticket, intent y ejemplos Gherkin numerados (E1, E2…), más la sección UI (con su nivel y, desde el nivel 2, maqueta y capturas, D31) si aplica y la sección Security en L y zonas críticas |
| **2. Comprobar** | PR abierta, CI en verde y revisiones atendidas | Sigue la lista de prueba en local (`pnpm work verify #n`) y, si quiere, mira el código señalado. Aprueba la PR (merge) o devuelve hallazgos | Paquete de verificación en el comentario "Work log" de la issue |
| **3. Publicar** | Smoke de staging en verde | Prueba en staging solo lo marcado "Solo verificable en staging" y promueve a producción | Comentario "Staging verification" y resumen de la versión |

Los once pasos con nombre siguen existiendo para el agente. La tabla es el recorrido completo (L y zonas críticas); S y M lo abrevian ("Recorrido por tamaño"):

| Etapa | Paso | Responsable | Artefacto | Control |
|---|---|---|---|---|
| **Define** | 1. **Discover** | Investigadores en paralelo; en un PRD, el slicer (D34) | Intent en el cuerpo de la issue: Problem · Proposed outcome · Affected users and systems · Constraints · Open questions · Agreements (formato del AI-native SDLC playbook de Anthropic, más los acuerdos) | 🧑 Momento 1 |
| | 2. **Specify** | Orquestador (+ UI/UX y seguridad si aplica) | Ejemplos Gherkin definitivos numerados (E1, E2…) en la issue; sección UI (D31) y, en L y zonas críticas, sección Security (D32) en la issue | 🧑 Momento 1 |
| | 3. **Design** | Planificador (solo L) | `plan.md` (temporal en la rama): modelo de datos, contratos de API, migraciones, flags, eventos de analítica, riesgos | Revisores automáticos; lo relevante pasa a "Decisions made" |
| | 4. **Tasks** | Planificador + test designer (D30) | Diff de la spec viva en la rama (`@wip(#n)`) con los ejemplos aprobados y su `@id` definitivo (`pnpm specs:ids`, D52); **escenarios de aceptación protegidos** (D30); `tasks.md` con los tests que fallan (`it.fails`) como primera oleada | `pnpm plan:check`; el spec reviewer comprueba que la spec y los escenarios recogen exactamente los ejemplos aprobados |
| **Build** | 5. **Implement** | Implementadores (TDD, un commit por tarea, oleadas) | commits | `pnpm check` en verde por oleada ("Tests que fallan", abajo) |
| | 6. **Verify** | Spec reviewer; UI/UX y seguridad si aplica; verificador | Hallazgos y rondas en el comentario "Work log"; el verificador explora en local y prepara el paquete de verificación | Bucle de hasta 3 rondas |
| | 7. **Document** | Redactor | Ayuda (D25), changelog (D26) y capturas (D28) cuando el cambio es visible | El orquestador lo decide con esas reglas y lo anota en el paquete |
| **Deliver** | 8. **Pull request** | Orquestador con `pnpm work pr`; CI genera "Verification"; CodeRabbit revisa | PR | CI en verde y comentarios atendidos → 🧑 Momento 2 |
| | 9. **Staging** | Despliegue automático, migraciones, smoke | Comentario "Staging verification" en la issue | 🧑 Momento 3 |
| | 10. **Release** | Despliegue a producción, smoke de solo lectura, ventana de observación del verificador | Comentario "Release verification" en la issue | Automático: ventana limpia → Close; si no, D39 |
| **Learn** | 11. **Close** | Orquestador con `pnpm work close`, sin preguntas | Issue cerrada; ADRs y glosario; aprendizaje propuesto en el comentario de cierre si lo hay | — |

**Reglas del ciclo**
- **Paradas obligatorias**: entre los momentos, el agente solo para y pregunta a la persona si:
  1. **Ambigüedad que cambia el comportamiento**: los ejemplos no cubren un caso y hay dos respuestas razonables con resultados distintos para el usuario; o la implementación contradice un ejemplo aprobado o el diseño aprobado (D31).
  2. **Algo irreversible**: el paso de contraer de una migración (D33), borrar datos, cambiar un contrato de API que ya se usa (D41) o publicar algo de la lista "No entra" del repo público (D43).
  3. **Coste o proveedor nuevo**: una dependencia de proveedor (D53) o un servicio de pago.
  4. **Zona crítica sin cubrir**: sesión, aislamiento, billing o secretos, cuando la spec no dice nada.
  5. **Atasco**: tras 3 rondas del bucle Implement ↔ Verify, o al agotar su presupuesto de intentos; para con un informe (dónde está bloqueado y qué probó).

  Todo lo demás lo decide el agente y lo anota en "Decisions made" del paquete de verificación.
- **Paquete de verificación** (lo publica el orquestador en el comentario "Work log" al llegar al momento 2):
  1. Cómo arrancarlo: `pnpm work verify #n` crea el worktree de la rama, reinicia la base local con el seed, arranca la app y abre el navegador.
  2. **Lista de prueba** sacada de los ejemplos, con las cuentas del seed ("entra como Ana, admin de Northwind; ve a Miembros; intenta quitar a Marc: pide DELETE").
  3. Lo que ya se comprobó solo: tests, matriz de ejemplos, axe, capturas en escritorio, móvil y oscuro, vídeos de Playwright de los recorridos.
  4. **Decisions made**, una línea cada una.
  5. Lo que no se hizo o no se pudo comprobar, y lo marcado **"Solo verificable en staging"** (login real, emails reales, pagos en modo test, móvil real, rendimiento).
  6. **Código que vale la pena mirar**: de 2 a 5 sitios con el porqué (permisos, consultas con `tenant_id`, migraciones), no el diff entero.

  Si la lista de prueba sale larga, el ticket era demasiado grande: el slicer corta más fino y queda como aprendizaje.
- **Entornos**: en local se comprueba que hace lo pedido (rama aislada, seed, login falso, emails capturados, servicios falsos); en staging, que funciona en la plataforma real con servicios reales (D44). Se acepta en local porque rechazar ahí no toca `master`.
- **Recorrido por tamaño**: los tres momentos son los mismos; el tamaño decide qué pasos y cuánta revisión automática hay. Tabla y reglas en D52.
- **Ejemplos congelados desde el momento 1**: si la implementación o la comprobación de la persona los contradicen, es la parada 1: la persona aprueba de nuevo los ejemplos afectados y se reabren sus escenarios (D30). Tras el merge, la spec viva queda en `master` y el cambio en la historia de git y de la PR.
- **Estado actual** (D16): `PROGRESS.md` hasta Document; comentario "Progress" de la PR durante la revisión; comentarios de la issue en Staging y Release.
- **Revisión de la PR (paso 8)**: cada comentario de CodeRabbit o de CI se clasifica como un hallazgo de Verify: fallo o ajuste → nueva casilla en la checklist de la issue → Implement → Verify; cambio de alcance → issue nueva. Lo resuelve el agente antes del momento 2.
- **Bucle Implement ↔ Verify**: máximo 3 iteraciones por fallos frente a la spec; después, parada 5. Las rondas que abre la persona en el momento 2 no cuentan, pero quedan en el comentario "Work log".
- **Tests que fallan**: los tests unitarios y de integración de la primera oleada se commitean como fallos esperados (`it.fails` de Vitest), así `pnpm check` y el pre-commit siguen en verde; el implementador quita la marca al implementar. Los escenarios de aceptación (`e2e/acceptance/`, D30) no corren en pre-commit ni cuentan para el verde por oleada; deben estar en verde en `pnpm work pr` y en CI.
- **UI y Security**: el diseñador UI/UX (estados y flujo; M y L) y el revisor de seguridad (threat model; L y zonas críticas) escriben sus secciones en Specify, antes del momento 1, en la issue junto al intent. En Design (solo L), `plan.md` recoge únicamente lo técnico que se derive (p. ej. cabeceras, validaciones); no reabren la spec.
- **Varios tickets a la vez**: el agente puede llevar varios en worktrees paralelos dentro del límite de trabajo en curso (D37); la persona los comprueba por lotes.
- **Formato de `tasks.md`**:
  ```markdown
  | ID | Task                               | Depends on | Touches                                                                          | Size | Level    | Status |
  |----|------------------------------------|------------|----------------------------------------------------------------------------------|------|----------|--------|
  | T1 | Failing tests: invitations         | —          | apps/api/src/companies/invitations/*.test.ts                                     | S    | max      | done   |
  | T2 | Migration: invitations table       | —          | packages/db/migrations/global/                                                   | S    | max      | done   |
  | T3 | POST /invitations endpoint         | T1, T2     | apps/api/src/companies/invitations/invite-member.ts, packages/domain/companies/invitations/ | M    | standard | doing  |
  | T4 | Invitation email                   | T2         | apps/api/src/companies/invitations/invitation-email.tsx                          | S    | standard | todo   |
  | T5 | "Invite member" screen             | T3         | apps/web/src/companies/members/                                                  | M    | standard | todo   |

  Waves: 1 → T1 [P] T2 · 2 → T3 [P] T4 · 3 → T5
  ```
  - Dos tareas van en paralelo (`[P]`) solo si no dependen entre sí y no tocan los mismos ficheros.
  - **Puntos calientes siempre en secuencia**: migraciones, `package.json` y lockfile, registro central de rutas, configuración compartida.
  - Con ficheros disjuntos, los implementadores trabajan en la misma rama y el orquestador hace los commits en orden; si hace falta aislar más, worktrees integrados antes de la siguiente oleada.
  - `pnpm plan:check` valida dependencias, ciclos y solapes.
- **Verify (paso 6) y hallazgos del momento 2**: el verificador prepara la prueba local (`wrangler dev` + `pnpm db:seed`) y explora antes que la persona. Cada hallazgo, del agente o de la persona, se clasifica:

| Tipo | Ejemplo | Destino |
|---|---|---|
| Fallo | No cumple un ejemplo aprobado | Nueva tarea (en `tasks.md` o, con la PR abierta, en la checklist de la issue) → Implement → Verify → paquete nuevo |
| Ajuste dentro del alcance | Texto, orden de campos, un estado que se ve mal | Igual (si es UI, valida el diseñador UI/UX) |
| Cambio de alcance | Algo que los ejemplos no contemplaban | Vuelve al momento 1 (ejemplos aprobados de nuevo) o issue nueva si no es imprescindible |

  Nada se corrige sin tarea.
- **Document (paso 7)**: todo lo que debe ir en la misma PR que el código se hace aquí. Se comprueba que el diff de la spec viva cubre todo el comportamiento cambiado (D24). Ayuda (D25), changelog (D26) y capturas (D28) son condicionales: el orquestador decide si el cambio es visible con esas reglas y lo anota en el paquete; la persona puede corregirlo en el momento 2.
- **Staging y Release (pasos 9 y 10)**: el código ya está en `master`, así que nada vuelve a la rama del ticket. Los hallazgos se registran como comentario en la issue:

| Tipo | En Staging | En Release |
|---|---|---|
| Fallo grave | Revert en `master` si no se arregla al momento → `bugfix/` → ciclo completo → Staging. No se promociona mientras tanto | Apagar el flag si existe; si no, rollback del Worker → `hotfix/` (lo confirma la persona; severidad según D39) |
| Fallo menor / ajuste | La persona decide: bloquea la promoción (`bugfix/` antes de producción) o no (issue nueva) | Issue nueva `bugfix/`, ciclo normal |
| Cambio de alcance | Issue nueva | Issue nueva |
| Fallo de entorno | Se corrige la configuración sin tocar código y se anota en el runbook | Igual |

  - Ventana de observación en Release: una comprobación programada lanza al verificador, que revisa errores nuevos en Sentry, métricas del Worker y SLOs (D39). Si sale limpia, el ticket pasa a Close sin intervención; si no, se avisa a la persona y se sigue la tabla. Duración fijada en el runbook de despliegue.
  - El ticket solo pasa a Close cuando la ventana de observación de su Release sale limpia; `pnpm work close` lo cierra sin preguntar.
- **Arranque**: hasta que existan las piezas del PRD "Working foundation" (issues, CI, GitHub App, `pnpm work`, `plan:sync`), sus tickets aplican el ciclo con las excepciones de D35.
- **Registro**: en todos los tamaños, los saltos de fase, paradas, hallazgos, rondas y el paquete de verificación se registran en un único comentario **"Work log"** de la issue, que el orquestador edita (como "Progress"); la matriz ejemplo ↔ test la genera CI en el comentario "Verification" de la PR (D52).

### D21 — Orquestador + subagentes (estrella)
- Solo el orquestador habla con la persona; es dueño de los tres momentos, las paradas obligatorias (D20), los artefactos y los bucles.
- Cada subagente recibe un encargo autocontenido (objetivo, ficheros y ADRs, criterio de terminado, qué no tocar) y devuelve: estado (`done` / `blocked` / `failed`), resumen, evidencias, ficheros tocados, preguntas abiertas.
- Los subagentes no hablan con la persona ni entre sí, ni lanzan otros subagentes.
- Lectura en paralelo libre; escritura en paralelo solo según las oleadas de `tasks.md` (D20).
- Los revisores reciben spec + diff, no el razonamiento del implementador.
- **Roles**: slicer (D34), researcher, UI/UX designer (D31), planner, test designer (D30), implementer, writer (paso Document), spec reviewer, security reviewer (D32), verifier. Definidos en `docs/agents/<role>.md` (inglés) con adaptadores por herramienta (`.claude/agents/`). Sin soporte de subagentes, el orquestador ejecuta los roles en secuencia.
- **El orquestador** no es un subagente: sus reglas (momentos, paradas, bucles, `PROGRESS.md`, encargos) viven en `docs/agents/orchestrator.md`, enlazado desde `AGENTS.md`.
- Límites de permisos de los agentes: D41.

### D22 — Modelo y esfuerzo según complejidad
| Nivel | Modelo hoy | Esfuerzo | Uso |
|---|---|---|---|
| fast | Haiku 5.5 | bajo | búsquedas de solo lectura, ejecutar `check` y resumir |
| standard | Sonnet 5.5 | medio | tarea bien especificada, planes pequeños, review normal |
| max | Opus 5.5 | alto | decisiones de diseño, planes transversales, depuración tras el 2.º fallo |

- El orquestador, el slicer y el security reviewer trabajan en `max`.
- Nivel por defecto por rol (frontmatter) y ajuste por tarea según la columna `Level` de `tasks.md`.
- **Siempre `max`**: auth/sesión, aislamiento entre empresas, migraciones, billing, secretos.
- Escalado automático: un `failed` / `blocked` reintenta un nivel más arriba; se escala a la persona tras agotar `max`.
- El nivel solo sirve para enrutar: no se registra en la checklist ni se mide. Tabla y reglas en `docs/agents/routing.md` (un solo sitio para cambiar modelos).

### D23 — Branching y despliegue
```
feature|bugfix|hotfix/<issue>-<slug>  ← desde master
  → PR a master (CI + AI review; revisiones atendidas)
  → momento 2: la persona comprueba en local (pnpm work verify) y aprueba → squash merge
  → despliegue automático a staging → smoke
       ✗ → revert en master si no se arregla al momento → bugfix/ → repetir
  → momento 3: la persona prueba lo marcado y aprueba → producción (el mismo commit)
       ✗ → apagar flag o rollback del Worker → hotfix/ → repetir pasando por staging
  → ventana de observación limpia → Close
```
- Rama principal: **`master`**, protegida (PR obligatoria, CI en verde, rama al día, aprobación humana).
- **`master` siempre desplegable**: revert antes que arreglar sobre `master` roto. Squash merge = un ticket, un commit, un revert.
- Features grandes o arriesgadas detrás de feature flag: desplegar ≠ activar.
- **bugfix vs hotfix** (por urgencia, no por dónde se detecta):
  - `bugfix/`: error que no llegó a producción, o que en producción puede esperar. Ciclo normal.
  - `hotfix/`: error en producción que afecta a usuarios y no puede esperar (SEV1/SEV2, D39). Primero apagar el flag o rollback; recorrido S, con los revisores de L si toca una ruta de zona crítica (D52); prioridad sobre el resto; **pasa igualmente por staging**. Lo confirma la persona.
- Futuro opcional: previews por PR antes del merge (hoy choca con un solo juego de bases D1 de staging).

### D24 — Visión, dominios, PRDs y tickets
- **Conceptos** (definidos en `GLOSSARY.md`):

| Concepto | Vida | En GitHub | En el repo |
|---|---|---|---|
| **Vision** | Viva | — | `docs/product/vision.md`: visión, idioma, no funcionales globales, roadmap |
| **Domain** | Permanente | Etiqueta `area:<domain>` | `docs/domains/<domain>.md`: **living spec** |
| **PRD** | Temporal (semanas); se cierra al cumplir su resultado | Issue padre, `type:prd`: el PRD es su cuerpo | — |
| **Ticket** | Una rama, una PR, un commit | Sub-issue (o suelta); intent en su cuerpo | Sin carpeta: su **change spec** es el diff de la spec viva en la PR |
| **Task** | Horas | Casilla en la issue del ticket | Fila de `tasks.md` (temporal en la rama) |

- "PRD" y "ticket" son vocabulario nuestro sobre issues y sub-issues; GitHub no los define.
- **Dominios iniciales** (con spec viva): `access`, `companies`, `billing`, `public-site`. **Etiquetas de apoyo** (sin spec viva, solo filtran el tablero): `platform`, `content`, `backoffice`. Reparto y regla de propiedad en D52.
- **Origen y padre de cada tipo de ticket**:

| Tipo | De dónde sale | ¿PRD padre? |
|---|---|---|
| `feature` | Slicing | Siempre |
| `chore`, `spike` | Slicing o suelto | Solo si sale del slicing |
| `bug` | Pruebas, staging, producción o usuarios | Si su PRD sigue abierto; si no, issue suelta |

- **Etiqueta `area:` obligatoria en todo ticket**, tenga PRD o no: un dominio indica qué living spec actualizar; una etiqueta de apoyo solo filtra el tablero.
```
docs/product/vision.md
docs/domains/                  ← living specs (permanentes), una por dominio
  access.md
  companies.md
  billing.md
  public-site.md
docs/platform.md             ← entornos, pipelines, copias, alertas (operación)
docs/learnings.md            ← aprendizajes (D52)
```
- PRDs y tickets no tienen carpeta: viven en sus issues. `plan.md`, `tasks.md` y `PROGRESS.md` son temporales de la rama (D16).
- Las ramas usan el número de issue sin ceros a la izquierda (`feature/15-invite-by-email`).
- **Dos tipos de spec**: **living spec** (`docs/domains/<domain>.md`, el comportamiento actual, siempre al día) y **change spec** (el diff de la living spec en la PR del ticket, con reglas `@wip(#n)`: qué cambió; el porqué está en la issue; congelada desde su aprobación, D20).
- **Regla de documentación** (paso Tasks, D20): todo ticket que cambie o aclare comportamiento actualiza la living spec de sus dominios **en la misma PR**. El spec reviewer lo comprueba. También aplica en S.

### D25 — Ayuda al usuario con Starlight
- **Decisión**: Starlight (docs de Astro) como integración dentro de `apps/marketing`, servido en `/docs` (`en`) y `/es/docs` (`es`) con el soporte multiidioma de Starlight (D47). Markdown en `apps/marketing/src/content/docs/`; `en` primero, `es` cuando se traduzca.
- HTML estático en el mismo Worker (D12): sin proyecto, despliegue ni coste extra. Búsqueda con Pagefind.
- **Regla**: un cambio visible actualiza la guía en la misma PR (paso Document). Decide el orquestador con las reglas de D20; la persona puede corregirlo en el momento 2.
- La SPA enlaza a `/docs/...` desde cada pantalla.
- **Descartado**: Outline, GitBook/Mintlify, base de conocimiento de Crisp.
- **Revisar si** la ayuda pasa a escribirla personal que no usa Git (CMS sobre los mismos markdown).

### D26 — Changelog para usuarios
- **Decisión**: una entrada markdown por cambio visible en `apps/marketing/src/content/changelog/<date>-<slug>.md`; página `/docs/changelog` con feed RSS.
- **Regla**: en la misma PR que el cambio (paso Document), en lenguaje de cliente y enlazando a la guía. Decide el orquestador con las reglas de D20; la persona puede corregirlo en el momento 2.
- Aparece en producción exactamente cuando sale la funcionalidad (D12). Si sale apagada tras un flag, `draft: true` hasta activarlo.
- Historial técnico: el `git log` de `master` (D23).
- **Aplazado**: aviso de novedades dentro de la app. **Descartado**: Changesets, GitHub Releases, versionado semántico.

### D27 — Legal y protección de datos
> Los textos legales los redacta o revisa un abogado. Aquí se decide dónde viven, cómo se versionan y qué hace el sistema.

- **Páginas** (`apps/marketing`, `/legal/*` y `/es/legal/*`, markdown con versión y fecha, cambios solo por PR): aviso legal (LSSI), privacidad, términos, cookies, DPA (somos encargados del tratamiento) y lista de subencargados. En `en` y `es`, ambos revisados por el abogado; la aceptación registra versión **e idioma**.
- **Aceptación registrada** en `DB_GLOBAL` por versión; un cambio relevante vuelve a pedirla. Casilla nunca premarcada.
- **Cookies**: solo técnicas (D8), sin banner. Nada que ponga cookies no técnicas se carga sin consentimiento previo (la analítica es cookieless, D38).
- **Subencargados y ubicación de los datos**: los de D63, con su ubicación y las garantías de las transferencias, en la política de privacidad.
- **Supresión** (§31): bloqueo inmediato + purga, incluidos KV, los ficheros de R2 (D62) y la analítica. Las copias se borran al caducar su retención. Una empresa se borra en el orden de D53: marca en el registro global, Workflow que vacía el shard y, al final, lo de global.
- **Acceso y portabilidad**: exportación a petición desde el backoffice en v1; autoservicio más adelante.
- **Retención** definida para sesiones, logs, copias y empresas dadas de baja.
- **Landings de empresa**: la responsable es cada empresa; el editor incluye pie con sus enlaces legales.
- **Documentación interna** (`docs/compliance/`): registro de actividades de tratamiento y transferencias internacionales por subencargado (DPF o cláusulas contractuales tipo).
- **Abierto**: residencia de datos en la UE; si se exige, verificar qué ofrece D1 antes de crear las bases de producción.

### D28 — Imágenes en la documentación
- En el repo, junto a la guía que las usa, con ruta relativa; versionadas en la misma PR. Astro las optimiza (WebP/AVIF, responsive, lazy).
- **Capturas generadas**: `pnpm docs:screenshots` con Playwright y seed fijo; resaltados con CSS inyectado; variantes clara y oscura si hace falta.
- **Reglas en `pnpm check`**: `alt` obligatorio; ≈ 500 KB máximo por imagen fuente; diagramas como código (Mermaid).
- **Aplazado**: imágenes en R2, vídeos y GIFs. **Descartado**: Git LFS.

### D29 — Estrategia de tests
Forma de trofeo: el grueso son tests de integración contra el runtime real. TDD obligatorio.

| Capa | Herramienta | Qué cubre | Cuándo |
|---|---|---|---|
| Unit | Vitest | Lógica pura: slugs, `resolveTenant()` (ambos modos), Zod, permisos, render de secciones | `pnpm check` |
| **Integration** | Vitest + `@cloudflare/vitest-plugin` | Peticiones reales al Worker en workerd con D1/KV locales, migraciones y seed | `pnpm check` |
| Component | Vitest + Testing Library | Solo componentes de la SPA con lógica propia | `pnpm check` |
| E2E | Playwright | Recorridos críticos contra `wrangler dev`, con axe (D31) | `pnpm e2e`: obligatorio en CI de cada PR que toque una app; solo los de las apps afectadas (D13) |
| Smoke | Playwright (subconjunto) | Staging: ejemplos de la spec. Producción: solo lectura | CI tras cada despliegue |

- **Dónde viven los tests** (13 nov 2026): **junto al código que prueban**, por defecto. `invite-member.ts` y `invite-member.test.ts` en la misma carpeta; se mueven y se borran juntos, y un módulo sin su test se ve.
  - Sufijos por tipo: `*.test.ts` (unit y component) y `*.int.test.ts` (integración en workerd), para que Vitest ejecute cada tipo con su configuración.
  - Aparte, solo lo que prueba el sistema y no un fichero: suites transversales (aislamiento, cabeceras) en `apps/<app>/test/`; E2E en `apps/<app>/e2e/`; utilidades compartidas (fixtures, factorías, login falso) en su propio paquete o carpeta.
  - El build excluye los tests y dependency-cruiser impide que el código de producción importe un `*.test.ts` (D17).
- **Escritura de tests** (13 nov 2026):
  - Nombres de tests en inglés (D36).
  - Sin `as any` ni tipos forzados en tests.
  - Los servicios de proveedor se sustituyen por la **versión falsa de su adaptador** (D53), nunca con `vi.mock('<paquete del proveedor>')`.
  - Factorías `make<Entidad>(overrides)` con IDs UUIDv7 fijos y fechas fijas, compartidas por tests, seed (D44) y E2E.
  - La API se prueba llamando a la app con un entorno inyectado por test (`app.request(ruta, init, env)`), incluidos los casos negativos (firma de webhook ausente o inválida).
- **Suite de aislamiento obligatoria**: recorre todas las rutas con empresa usando la sesión de otra y exige 404. Las rutas nuevas entran solas.
- **Edge cases fijos**: límites, nulos, unicode, concurrencia (mismo slug en paralelo), aislamiento.
- **Servicios externos** (WorkOS, Stripe, Brevo) simulados interceptando `fetch`; webhooks de Stripe con firmas reales de fixture.
- **Sin objetivo de cobertura en %**: cada ejemplo de la spec viva tiene al menos un test que cita su `@id`; CI lo comprueba y genera la matriz en el comentario "Verification" de la PR (D52).
- **Un solo Playwright** para E2E, smoke y capturas: mismos seeds y selectores `data-testid`.
- E2E con reintentos y trazas guardadas al fallar en CI.
- El contrato API ↔ SPA lo comprueba la compilación (D19).
- **Login en E2E**: adaptador de autenticación con WorkOS y un proveedor falso que acepta usuarios del seed; el falso solo existe en local y test y **el build de producción falla si lo incluye**.
- **Login en smoke de staging**: WorkOS real, con usuarios de prueba propios del entorno staging de WorkOS (los crea la persona, 🧑) cuyos emails coinciden con los del seed; sus credenciales viven como secretos del GitHub Environment `stg`. Producción no tiene usuarios de prueba: su smoke es de solo lectura y sin login.
- **Empresas de los E2E y smoke** (13 nov 2026): nunca la empresa demo ni, si se adopta P-1, la empresa plantilla.
  - Los tests que solo leen usan las empresas del seed (D44).
  - Los que escriben (invitar, cambiar de rol, borrar la empresa) crean su propia empresa con slug `e2e-<aleatorio>`, para no pisarse al ejecutarse en paralelo. En staging, el smoke borra al terminar las empresas `e2e-…`.
  - Si se adopta P-1, la creación de empresa se prueba con una instantánea de plantilla fija incluida en el seed.
  - El smoke de producción lee la página pública de la empresa demo: real y estable, sin tocar datos de clientes.
  - **Empresa demo** (14 nov 2026): flag `is_demo` de la empresa; queda fuera de métricas, analítica y cobros, y su página pública lleva `noindex`.
- **Aplazado**: regresión visual, tests de carga.

### D30 — Test designer
- **Principio**: quien diseña los tests no es quien implementa (mismo motivo que los revisores independientes de D21).
- **Rol** (`docs/agents/test-designer.md`): recibe la change spec y el plan (`plan.md` o `tasks.md`), **no** la implementación. Entrega los casos por capa ligados a los ejemplos de la spec, más los edge cases de D29, y **los escribe como tests que fallan** (`it.fails`, D20): son la primera oleada de `tasks.md`.
- Nivel `standard`; `max` en zonas críticas.
- Cuándo es obligatorio: según el tamaño (D52).
- **Escenarios de aceptación protegidos** (14 nov 2026): los tests de aceptación los escribe y los fija alguien distinto del implementador, antes de que exista implementación. Si el mismo sistema de agentes escribe los tests y el código, un malentendido compartido sale en verde.
  - **Qué son**: un E2E de Playwright por cada ejemplo aprobado en el momento 1 (D20), que cita su `@id` y recorre la app como un usuario (interfaz o API pública), en `apps/<app>/e2e/acceptance/`. Cuándo son obligatorios: según el tamaño (D52). No corren en pre-commit ni cuentan para el verde por oleada; deben estar en verde en `pnpm work pr` y en CI (D20).
  - **Primero y después intocables**: en la PR, los commits que tocan `e2e/acceptance/` tienen que ir antes que cualquier commit que toque otra ruta; antes solo se admiten commits en `docs/**`, `PROGRESS.md`, `plan.md` y `tasks.md`. CI falla si no. Sin force push en ninguna rama (D41), el orden no se puede reescribir.
  - **Reabrirlos** (un escenario mal escrito, o un ejemplo aprobado de nuevo en la parada 1 de D20) exige un comentario `/reopen-acceptance` de la cuenta de la persona en la issue. CI comprueba el autor: la GitHub App de los agentes no puede emitirlo (D41).
  - **El implementador no los edita** (permisos de D41) y adapta el código a la spec, no al test. Puede ejecutarlos y ver qué ejemplo falla y en qué paso.
  - El spec reviewer comprueba que hay exactamente un escenario por ejemplo aprobado y que cada uno dice lo mismo que su ejemplo; un ejemplo sin escenario es un fallo de Verify.
  - **Tras el merge** siguen en la suite E2E de cada PR (D29) y son la base del smoke de staging. Cambiar el escenario de una regla existente solo es posible en un ticket cuyo momento 1 aprobó ese cambio, con la misma regla de orden.
- **Sugerencias en otros pasos**: Implement, proponer E2E al tocar una pantalla o recorrido crítico; Verify, el spec reviewer marca como fallo todo ejemplo sin test; Document, proponer regenerar capturas si cambió la interfaz.

### D31 — UI/UX designer: interfaz, accesibilidad y SEO
- **Requisito previo**: `docs/design/` (tokens claro/oscuro, componentes shadcn adaptados, patrones de formularios, tablas, drawers y estado en URL, tono de los textos). ADR propio aceptado (`docs/adr/draft-design-system.md`).
- **Rol** (`docs/agents/ui-ux-designer.md`). **No implementa**: diseña y revisa.

| Momento | Qué hace | Entrega |
|---|---|---|
| PRD (P1) | **Prototipo navegable** (HTML o artifact) para validar con la persona antes del slicing. Recomendado en PRDs con interfaz nueva | Prototipo enlazado en la issue del PRD |
| Specify | Flujo y **todos los estados** de cada pantalla: vacío, cargando, error, sin permisos, datos largos/unicode, móvil | Sección UI en la issue, junto al intent (M y L) |
| Verify | Revisa contra la spec y `docs/design/` sobre capturas en claro/oscuro y móvil/escritorio | Matriz en el comentario "Work log" de la issue |

- **Niveles de cambio de interfaz** (14 nov 2026). Cómo se ve una pantalla es parte de lo que se pide, así que lo visible se aprueba en el momento 1 (D20), junto a los ejemplos. El diseñador propone el nivel y la persona lo confirma con el tamaño:

| Nivel | Cambio | Qué se aprueba en el momento 1 |
|---|---|---|
| **0** | Nada visible | Nada |
| **1** | Dentro de un patrón existente: un campo, una columna, un texto, un estado | Descripción en la sección UI de la issue, nombrando el patrón; sin maqueta. Se ve en la pantalla real en el momento 2 |
| **2** | Pantalla nueva, o cambio importante de una existente, con patrones existentes | Maqueta con todos los estados (vacío, cargando, error, sin acceso, móvil, oscuro); en un cambio, antes y después lado a lado |
| **3** | Patrón o componente que no existe en `docs/design/` | Lo del nivel 2 más la propuesta del patrón o componente, con el porqué. El cambio en `patterns.md` o `components.md` va en la misma PR. El ticket es como mínimo M |

  - **Sin diseño previo**: el diseñador busca primero en `docs/design/` el patrón que encaja y compone con lo que hay (nivel 2); si nada encaja, nivel 3. En un PRD con varias pantallas nuevas, esto es el prototipo navegable.
  - **Diseño existente que debe cambiar**: al pedir, se parte de una captura de la app actual y se enseña el antes y el después. Durante la implementación, un ajuste dentro del patrón que no cambia lo que hace la pantalla lo decide el agente, con captura del antes y el después en "Decisions made". Si contradice la maqueta aprobada o cambia de forma visible lo que ve el usuario, es la parada 1 de D20. En el momento 2, lo que no guste es un hallazgo "Ajuste dentro del alcance".
  - **Dónde vive**: la maqueta, en HTML en el prototipo (fuera del repo); las capturas aprobadas (claro y oscuro, escritorio y móvil), en la sección UI de la issue, como registro temporal (D52). Tras el merge, **la verdad es la app implementada** más las reglas de `docs/design/`: el lienzo y el prototipo no se mantienen como espejo de la app y sirven para proponer cambios. El lienzo sigue mandando en los tokens y en las pantallas aún no construidas.
  - **Verify**: el revisor UI/UX compara la implementación con las capturas aprobadas y con `docs/design/`.
- **Accesibilidad** (WCAG 2.2 AA): teclado, foco, contraste, etiquetas y errores asociados, `alt`, `prefers-reduced-motion`, objetivos táctiles, lectores de pantalla en drawers y modales. Automático: `@axe-core/playwright` en cada E2E; infracciones graves rompen CI.
- **SEO** (solo páginas públicas: marketing, ayuda, changelog, landings): título y descripción únicos, Open Graph, canonical, `hreflang` entre idiomas (D47), `sitemap.xml`, `robots.txt`, datos estructurados donde aporten, encabezados correctos, imágenes optimizadas. Landings: campos SEO por empresa y entrada en el sitemap; al pasar de `path` a `subdomain`, 301 desde las URLs antiguas. App y backoffice con `noindex`. Automático: Lighthouse en CI con umbrales que rompen CI.
- **Cuándo**: el orquestador lo activa si el ticket toca interfaz o páginas públicas, o lo salta con el motivo en "Decisions made" (D20). **No se salta** en flujos nuevos completos ni en páginas públicas nuevas.
- Nivel `standard`; `max` en flujos nuevos completos. **Aplazado**: regresión visual.

### D32 — Security reviewer
- **Rol** (`docs/agents/security-reviewer.md`). Siempre `max`.

| Momento | Qué hace | Entrega |
|---|---|---|
| Specify (L y zonas críticas) | Threat model ligero: qué puede salir mal, quién lo explota, qué lo impide | Sección Security en la issue, junto al intent: amenaza → control → ejemplo verificable |
| Verify | Revisa el diff contra esa sección y la checklist fija | Matriz en el comentario "Work log" de la issue |

- **Checklist fija** (es la pasada de seguridad de `REVIEW.md`, D15): autorización y aislamiento (IDOR, suite de D29 en verde); **XSS en landings** (JSX escapa por defecto, texto enriquecido sanitizado, `dangerouslySetInnerHTML` prohibido sin sanitizador, CSP estricta); CSRF (`SameSite=Lax` + `Origin`); open redirect (`return_to`); inyección (solo consultas parametrizadas de Drizzle); sesión (expiración, revocación, rotación al iniciar sesión); firma de webhooks; secretos fuera de código, logs y errores; cabeceras (CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`); sin datos personales en logs, Sentry, telemetría ni analítica.
- **Obligatorio, no se puede saltar**: zonas críticas y todo contenido escrito por una empresa que se renderice. En el resto, sugerido.
- **Automático en CI** (los hallazgos críticos rompen CI): CodeQL (D58), gitleaks (pre-commit y CI), `pnpm audit`, Renovate para versiones y alertas de seguridad de Dependabot (§41, D58), test de integración de cabeceras.
- **Aplazado** (antes de abrir a clientes reales): pentest externo, `security.txt`, auditoría periódica.
- **Resuelve**: §42.

### D33 — Migraciones expand/contract
- **Problema**: CI migra y luego despliega; durante el despliegue y en cualquier rollback, el código anterior corre contra el esquema nuevo. El rollback no revierte la base.
- **Patrón** (ejemplo: renombrar `name` → `display_name`), tres tickets con su despliegue:

| Paso | Migración | Código | Rollback a la versión anterior |
|---|---|---|---|
| 1. Expand | Añade `display_name` nullable | Escribe en ambas; lee `display_name ?? name`; backfill por lotes | ✅ |
| 2. Migrate | — | Lee y escribe solo `display_name` | ✅ |
| 3. Contract | Borra `name` | — | ✅ |

  El paso 3 solo cuando el 2 ha superado en producción al menos una ventana de observación sin rollback.
- **Seguro en un paso**: crear tabla, añadir columna nullable o con default, crear índice.
- **Requiere varios pasos**: renombrar o borrar tabla o columna, cambiar tipo, `NOT NULL` sin default, `UNIQUE` sobre datos existentes. En SQLite, cambiar tipo o restricciones reconstruye la tabla: es contract y en tablas grandes puede chocar con los límites de D1.
- **Migración de todas las bases en CI**: carpetas `packages/db/migrations/global/` y `packages/db/migrations/shard/` (esta se aplica a cada shard); la lista de bases sale de `d1_databases`; orden global → shards uno a uno → despliegue; si una falla, se para y no se despliega; un fallo a mitad deja shards en esquemas distintos sin riesgo (son expansiones) y al reintentar wrangler salta lo aplicado. Último recurso: Time Travel (7 días Free / 30 Paid).
- **Reglas que lo hacen cumplir**:
  1. `pnpm db:lint-migrations` (dentro de `pnpm check`) falla ante contracciones salvo cabecera `-- contract: #<issue del paso Migrate>`. En local solo comprueba las cabeceras; CI comprueba además que esa issue ya está en producción y que pasó su ventana de observación.
  2. Las migraciones aplicadas no se editan: CI compara con `master`.
  3. **Test de compatibilidad hacia atrás** en PRs con migraciones: se aplican las nuevas y se ejecutan los tests de integración del commit anterior de `master`.
  4. Backfills aparte, con las reglas de D44.
  5. Al cerrar el ticket Expand, el orquestador abre los tickets Migrate y Contract enlazados.
  6. Migraciones siempre en secuencia en `tasks.md`; zona crítica (test designer y security reviewer obligatorios).

### D34 — PRDs, slicing y formato de tickets
- **PRD en lugar de épica**: un solo concepto es documento de producto y agrupador de tickets. Lo global vive en la visión y todos los PRDs lo heredan.
- **Rol "slicer"** (`docs/agents/slicer.md`), nivel `max`. Corta en dos niveles: visión → PRDs (roadmap) y PRD → tickets. **Debate mediado** (D21) en tantas rondas como haga falta.
- **Ciclo de un PRD**, previo al de cada ticket:

| Paso | Quién | Resultado | Momento |
|---|---|---|---|
| P1. **Write PRD** | Researchers (+ UI/UX con prototipo navegable recomendado, + security si aplica); debate con la persona | Cuerpo de la issue `type:prd` | 🧑 Momento 1 (D20): aprobar el PRD |
| P2. **Slice** | Slicer (story mapping) + orquestador, UI/UX y seguridad (Specify de cada ticket) | Mapa de tickets en la issue del PRD: valor, tamaño (S/M/L, D52), dependencias, orden; por ticket, intent y ejemplos definitivos numerados (E1, E2…) | 🧑 Momento 1 (D20): aprobar el slicing y los ejemplos de todos los tickets de una vez |
| P3. **Create tickets** | Orquestador | Sub-issues con plantilla, etiquetas y dependencias | — |

- El ciclo del PRD no tiene rama ni PR: el PRD se redacta y se aprueba en el cuerpo de su issue, y su estado va en un comentario "Progress" de esa issue (D16). Las decisiones tomadas al redactar el PRD van en sus secciones (Requirements, Non-functional, Assumptions and risks…), no en una sección aparte.

- **Plantilla del PRD** (cuerpo de la issue): Problem · Users · Hypothesis (opcional) · Goals and metrics · Appetite (alcance máximo) · Requirements · Non-functional (propios) · Solution sketch · Assumptions and risks · Non-goals · Launch criteria · Tickets. Contenido en español; encabezados en inglés.
- **Hipótesis y revisión de resultados** (outcome-driven en su versión mínima, D52): hipótesis opcional "Creemos que [cambio] hará que [usuarios] [comportamiento]; lo sabremos cuando [métrica] llegue a [umbral] en [plazo]". Si el PRD la tiene, al cerrarlo se añade un comentario "Outcome review" con el resultado y la decisión (seguir, ajustar o retirar); alimenta el roadmap. Sin hipótesis no hay revisión.
- **Reglas del slicer**: corte vertical (interfaz, API y datos; algo visible); **walking skeleton** primero (camino feliz mínimo de punta a punta); patrones por paso del flujo, de simple a complejo, por variación de datos, por rol, por operación; cada ticket desplegable solo (tras flag si hace falta) y INVEST; orden por valor y riesgo; `chore` solo sin corte vertical posible y justificado. Los requisitos del PRD no se corresponden uno a uno con tickets.
- **Formato de tickets: capacidad + ejemplos**. Se descarta la historia de usuario (como / quiero / para): en una base genérica casi todo empieza por "Como admin…" y el rol aporta poco.
- **Ejemplos en Gherkin** (`Given` / `When` / `Then`; práctica BDD / Specification by Example), **sin Cucumber**. Son los **criterios de aceptación** del ticket: definitivos y numerados en la issue (E1, E2…, aprobados en el momento 1) → spec viva en la rama con su `@id` definitivo (`pnpm specs:ids`, D52) → escenarios de aceptación protegidos y tests que fallan (test designer, D30) → cada uno con su test en verde en la matriz que genera CI (comentario "Verification").
- **Plantillas de issue** (`.github/ISSUE_TEMPLATE/`, encabezados en inglés). Todos los tickets llevan una etiqueta `area:` (dominio o de apoyo, D24):

| Tipo | Etiqueta | Secciones |
|---|---|---|
| PRD | `type:prd` | Plantilla del PRD (arriba) |
| Feature | `type:feature` | Capability · Value · Context (job story opcional) · Intent · Examples (Gherkin, E1, E2…) · Out of scope · Depends on · Tasks. El tamaño va en la etiqueta `size:` (D52) |
| Bug | `type:bug` | What happens · Expected (Gherkin → test de regresión) · Steps to reproduce · Environment · Severity (D39) · Evidence |
| Chore | `type:chore` | What · Why not vertical · Manual steps (🧑) · Done when (observable) |
| Spike | `type:spike` | Question · Timebox · Outcome (decisión o ADR, no código) · Out of scope |

- **Fuente de verdad según el momento**: los ejemplos aprobados en la issue (momento 1); en la rama, el diff de la spec viva, que debe coincidir con ellos. La issue conserva capacidad, intent y checklist de tareas.
- **Tareas en GitHub**: `pnpm plan:sync` escribe `tasks.md` como checklist en la issue. Solo `tasks.md` → issue; nadie edita la checklist a mano. Las tareas nuevas de Verify se añaden a `tasks.md` y se vuelve a sincronizar. Al abrir la PR, `tasks.md` se borra (D16) y la checklist pasa a ser la fuente: el orquestador añade y marca ahí las tareas de la revisión.
  - Estado en la columna `Status` de `tasks.md` (`todo` / `doing` / `done`), que el orquestador actualiza al empezar y al hacer el commit de cada tarea.
  - Formato en la issue (sintaxis de task list de GitHub: `[x]` minúscula y sin espacios, o GitHub no dibuja la casilla ni cuenta el progreso):
    ```markdown
    - [x] T1 · Failing tests: invitations
    - [x] T2 · Migration: invitations table
    - [ ] T3 · POST /invitations endpoint · 🔄 in progress
    - [ ] T4 · Invitation email
    - [ ] T5 · "Invite member" screen
    ```
  - Tickets S (sin `tasks.md`): la checklist de la issue es la fuente y el orquestador la marca directamente con el mismo formato.
- **Dependencias entre tickets**: relación nativa "blocked by" de GitHub (disponible en Free, verificado).
- **Definition of Ready** (`docs/process/definition-of-ready.md`): capacidad, valor y al menos un ejemplo; slicing de su PRD aprobado (si tiene PRD); dependencias resueltas o planificadas; tamaño confirmado (etiqueta `size:`, D52).
- **Definition of Done** (`docs/process/definition-of-done.md`): ventana de observación de la Release limpia (incluye `pnpm check`, Verify, Document, momento 2, Staging y momento 3).

### D35 — Trabajo técnico y PRD de arranque
| Caso | Cómo entra | Ejemplo |
|---|---|---|
| Lo exige una feature | Tareas dentro de ese ticket, no ticket propio | Tabla de invitaciones, configurar Brevo |
| Plataforma con objetivo medible | PRD de plataforma; sus tickets son chores | Backups and recovery: restaurar cualquier base en < 4 h con pérdida ≤ 24 h |
| Técnico suelto y pequeño | `chore` suelto | Ajustar Renovate, subir Node, añadir un secreto |

- Todo lleva la etiqueta de apoyo `area:platform` (sin living spec); `docs/platform.md` describe entornos, pipelines, copias y alertas actuales (D52).
- **PRD "Working foundation"** (el primero del roadmap), cinco chores; el detalle está en su issue, PRD #4: (1) repo, monorepo y `pnpm check` · (2) GitHub como código · (3) despliegue a staging y producción con observabilidad mínima · (4) contexto para agentes · (5) automatización del proceso. Orden: 1 → 2 → 4 → 3 → 5.
- **Excepciones de arranque** (solo en este PRD, mientras faltan las piezas):
  - Tickets 1 y 2: recorrido S sin issue previa; sus issues se crean al terminar el 2 y se rellenan con lo hecho.
  - Hasta que exista la GitHub App (fin del ticket 2), el agente solo trabaja en local: **los commits y push los hace la persona** y la creación del repo es 🧑.
  - Hasta que existan `pnpm work` y `plan:sync` (ticket 5), los temporales se borran a mano al abrir la PR y la checklist de tareas de las issues se mantiene a mano con el formato de D34.
- **Configuración como código**: `.github/labels.yml` sincronizado; rulesets aplicados por script; recursos de Cloudflare declarados en wrangler y creados por script. Los scripts que necesitan permisos de administración (rulesets, Environments, creación de recursos de Cloudflare) los escriben los agentes y **los ejecuta la persona** con su token (🧑).
- **Pasos manuales** marcados 🧑 en `tasks.md` y en la checklist de la issue (tokens, cuentas de WorkOS/Stripe/Brevo, aprobar entornos). El agente nunca maneja credenciales (D41).
- **"Done when" siempre observable**: "una PR de prueba pasa CI", nunca "CI configurado".
- **Tareas recurrentes**: runbook en `docs/runbooks/` + Action programada que abre la issue cuando toca (regla de crons de D48).
- **Backups**: hoy Time Travel (7 días). El PRD "Backups and recovery" es obligatorio antes de abrir a clientes reales, junto al pentest (D32).

### D36 — Idioma y glosario
- **Política de idioma**: en la visión. Resumen: toda la base técnica en inglés (código, esquema, rutas, ficheros, ramas, etiquetas, commits, títulos de PR, tests, `AGENTS.md`, agentes, procedimientos, runbooks, ADRs); procesos, PRDs y specs pueden ir en español; interfaz, emails, ayuda, changelog y legal multiidioma con `en` por defecto y `es` (D47).
- **`GLOSSARY.md`**, un término por concepto:
  - **Producto**: company, user, membership, role, staff, tenant (= company en el código), slug, landing.
  - **Proceso**: vision, domain, support label, PRD, hypothesis, outcome review, ticket, ticket size (S/M/L), task, wave, living spec, change spec (el diff de la living spec en la PR), `@wip` / `@issue` / `@id`, moment (los tres momentos de D20), mandatory stop, verification package, protected acceptance scenario, walking skeleton, learning, Definition of Ready / Done.
  - **Entrega**: PR, CI, staging, release, rollback, revert, hotfix, bugfix, feature flag, expand/contract, observation window.
  - **Operación**: SLO, SEV, incident, postmortem, runbook, DORA.
  - Cada término con su equivalencia en GitHub cuando la tiene.

### D37 — Roadmap, tablero y límite de trabajo en curso
- **Roadmap Now / Next / Later** en la visión: sin fechas comprometidas, ordenado por valor y riesgo; se revisa en la revisión mensual (D40).
- **Flujo continuo (Kanban)**, sin sprints.
- **GitHub Projects**, columnas por estado del ticket: Backlog → Ready (cumple DoR) → Define → Build → Review (PR abierta) → Staging → Release (en producción, en observación) → Done (ventana de observación limpia). Campo **"Espera a"** (persona / agente), que el orquestador actualiza al llegar a un momento o a una parada, para filtrar desde cualquier dispositivo (14 nov 2026).
- **WIP limit**: máximo 2 tickets en Build a la vez y 1 PRD en slicing. Antes de empezar algo nuevo, se termina lo que está en curso.
- Los PRDs se ven en la vista agrupada por padre con el progreso de sus sub-issues.
- **Lo que está en curso** se ve en el tablero y en `pnpm work status` (D52), nunca en `master`. Los tickets S pasan de Ready a Build sin Define. `pnpm work` mueve las tarjetas hasta Review; el workflow de despliegue las mueve a Staging, Release y Done.

### D38 — Analítica de producto
- **Problema**: los PRDs tienen métricas, pero nada las medía.
- **Decisión**: analítica de producto **cookieless** (sin banner, D27). Candidato: PostHog en modo sin cookies; alternativa: eventos propios en D1 con agregados. ⚠ Verificar límites del plan gratuito de PostHog y su modo cookieless antes de elegir. Si se elige PostHog, en su nube UE (D63).
- Eventos con nombre en inglés `object_action` (`company_created`, `member_invited`), definidos en el plan de cada ticket que afecte a una métrica del PRD: `plan.md` en L; `tasks.md` o la issue en M y S.
- Sin datos personales en los eventos; `tenant_id` sí, para métricas por empresa.
- Supresión de datos (D27) incluye la analítica.

### D39 — Operación e incidentes
- **SLOs iniciales** (`docs/platform.md`): disponibilidad de la API 99,5 % mensual; p95 de latencia de la API < 500 ms. Se revisan con datos reales.
- **Monitor externo de disponibilidad** (servicio gratuito, a elegir en el PRD "Working foundation") sobre `/health` de cada Worker (D48), más **alertas de Sentry** para errores nuevos y picos.
- **Severidades** (etiqueta `sev:1`–`sev:3` en la issue del incidente):

| SEV | Qué es | Respuesta |
|---|---|---|
| 1 | Caída, pérdida o fuga de datos, login roto, cobros erróneos | Inmediata: apagar flag o rollback → `hotfix/` |
| 2 | Funcionalidad importante rota para muchos usuarios | Mismo día → `hotfix/` |
| 3 | Error menor o con alternativa | `bugfix/`, ciclo normal |

- **Proceso**: detectar → mitigar (flag o rollback) → arreglar → **postmortem sin culpables** para SEV1 y SEV2 (`docs/process/postmortem-template.md`: cronología, impacto, causa raíz, qué funcionó, acciones con issue). Las acciones entran como tickets y los aprendizajes van a `docs/learnings.md` (D52), o directamente a un control automático, `AGENTS.md` o los procedimientos.
- **Runbooks** en `docs/runbooks/`: despliegue, rollback, restauración de D1, rotación de secretos, compra de dominio (D14).
- **Página "System health" en el backoffice** (PRD "Staff backoffice"): la salud de todo el sistema en un sitio, por entorno. Elementos iniciales:

| Elemento | Fuente | Qué muestra |
|---|---|---|
| Disponibilidad | Monitor externo sobre `/health` | Estado actual, uptime del mes frente al SLO |
| Versión desplegada | `/health` de cada Worker | SHA, PR y fecha por Worker y entorno |
| Errores | Sentry | Errores nuevos y tasa de error de las últimas 24 h |
| Rendimiento | Analytics de Cloudflare | p95 de latencia frente al SLO, CPU por petición |
| Cupos del plan | Analytics de Cloudflare | Peticiones del día / 100.000, filas escritas en D1 / 100.000, escrituras en KV / 1.000, tamaño de cada base / 500 MB (D48) |
| Tareas programadas | Último cron de cada Worker y GitHub Actions programadas | Última ejecución, estado y siguiente |
| Despliegues y copias | GitHub Actions | Último despliegue por entorno, antigüedad de la última copia |

  - Umbrales en color (normal / aviso / crítico), p. ej. aviso al 80 % de cualquier cupo, alineado con D26 del spec original (§26).
  - Solo lectura. Tokens de lectura (Cloudflare, Sentry, monitor, GitHub) como secretos del Worker `bo`, creados por la persona (🧑, D41).
  - Datos en caché de pocos minutos: la página no debe gastar el cupo que vigila ni superar las 50 subpeticiones por invocación (D48).
  - Diseño de referencia: la pantalla "System health" del lienzo de diseño (página Staff backoffice).

### D40 — Métricas del proceso y revisión mensual
- **DORA** calculadas desde GitHub, sin herramientas nuevas: deployment frequency, lead time for changes (primer commit → release), change failure rate (releases con rollback, hotfix o revert), time to restore.
- **Métricas del flujo con agentes**, automáticas desde GitHub y CI (comentario "Work log" de la issue, checklist, comentario "Verification" de la PR): iteraciones Implement ↔ Verify, hallazgos por tipo en Verify, reclasificaciones de tamaño, paradas obligatorias y duración de CI por PR (objetivo: menos de unos 10 minutos, D13).
- **Revisión mensual** (15 min, D52): métricas automáticas de GitHub y CI, tablero y WIP, marcas `paid-plan` por decisión (`pnpm debt`, D56), roadmap Now/Next/Later y poda de `docs/learnings.md` (lo que ya es control automático o línea de `AGENTS.md` sale).

### D41 — Límites de los agentes
- **Identidad propia**: los agentes trabajan en GitHub como una **GitHub App** propia, nunca con la cuenta de la persona. GitHub no deja aprobar la propia PR: si el agente usara la cuenta humana, la aprobación no valdría nada. La app tiene permisos mínimos (contenidos, pull requests, issues; sin administración) y no está en ninguna lista de bypass. La persona la crea e instala (🧑, PRD "Working foundation", ticket 2).
- **Mínimo privilegio**: los agentes no pueden mergear a `master`, aprobar Environments ni desplegar a producción; los rulesets exigen aprobación humana. Un ruleset sobre todas las ramas bloquea el force push, para que el historial de una PR no se pueda reescribir (escenarios de aceptación, D30). Los permisos del implementador le impiden editar `**/e2e/acceptance/**`.
- **Sin credenciales**: nunca crean, leen ni rotan secretos; no tienen tokens de producción. Los pasos con credenciales son 🧑 manuales (D35). Solo usan tokens de instalación de la GitHub App de 1 hora; la clave de la App está fuera de su alcance (D64).
- **AI review en CI**: cada PR recibe una revisión automática por IA que aplica `REVIEW.md` (D15), además de la humana y de los revisores del paso Verify. **Decidido (12 nov 2026): CodeRabbit en su plan gratuito**, que cubre los repos públicos (D43); se instala como app de GitHub después de crear el repo (ticket 2 de "Working foundation"), sin tocar CI. Comenta y propone; no aprueba ni bloquea, salvo un hallazgo de la lista "No entra" (D43). Alternativa o complemento: Claude Code Action con el token de una suscripción personal a Claude (`claude setup-token`), nunca con una suscripción de trabajo. Copilot review queda descartado (no entra en el plan gratuito).
- **Acciones irreversibles** (borrar datos, purgas, cambios de configuración de producción): siempre con confirmación explícita de la persona.

### D42 — Trazabilidad entre piezas
- **Identificador universal**: el número de issue de GitHub. PRD `#12`, ticket `#15`, tarea `#15/T3`. Todas las piezas llevan los identificadores de sus padres para navegar en ambos sentidos. No hay otra numeración (el roadmap nombra los PRDs por título).
- **Formato en texto**: `PRD #12` y `Ticket #15`, **con espacio**, para que se lea el tipo y GitHub siga enlazando `#12`. En trailers: `PRD: #12`, `Refs: #15`.
- **Títulos de issue**: los PRDs llevan prefijo, `[PRD] Team`; los tickets no (su tipo está en la etiqueta y su PRD en la relación de sub-issue).

| Pieza | Cómo se relaciona | Ejemplo |
|---|---|---|
| Ticket ↔ PRD | Sub-issue nativa de GitHub | `#15` hija de `#12` |
| Rama | Creada con `gh issue develop` (queda enlazada en la sección *Development* de la issue) y nombre con el ticket | `feature/15-invite-by-email` |
| Commit de tarea | Conventional commit + trailers | `feat(members): add POST /invitations` · `Refs: #15` · `PRD: #12` · `Task: T3` |
| PR | Título conventional; cuerpo con PRD y ticket (lo rellena `pnpm work pr`); comentarios "Plan" (si hay `plan.md`) y "Verification" (CI); mismas etiquetas `type:` y `area:` que el ticket; enlazada a la issue por la rama | `PRD #12` · `Ticket #15` |
| Commit en `master` (squash) | Título de la PR + número de PR que añade GitHub; cuerpo con trailers | `feat(members): invite members by email (#40)` · `Refs: #15` · `PRD: #12` |
| Living spec | Etiqueta Gherkin por regla (`Rule:`): `@wip(#n)` en la rama; `@issue(#n)` en `master`, la última issue que la cambió (D52) | `@issue(#15)` |
| Ejemplo ↔ test | Identificador estable del ejemplo (`pnpm specs:ids`), citado por su test | `@id:companies-15-1` |
| ADR | Frontmatter `related:` | `related: [12, 15]` |
| Ayuda y changelog | Frontmatter no visible para el usuario | `ticket: 15` |
| Migración | Cabecera | `-- ticket: #15` |
| Feature flag | Registro del flag con su ticket, para saber cuándo retirarlo | `ticket: 15` |
| `PROGRESS.md` / comentario "Progress" | Cabecera | `PRD #12 · Ticket #15 · Branch: …` |
| Despliegue | Mensaje de la versión del Worker y release de Sentry = SHA del commit | `wrangler deploy --message "#40 a1b2c3d"` |
| Incidente | Issue `sev:*` que enlaza la PR causante y los tickets de arreglo | `Caused by #40` · `Fixed by #52` |

- **Nunca "Closes #15"** en commits ni PRs: cerraría el ticket al mergear, y el ticket se cierra en Close, tras una ventana de observación limpia (D20). Se usa `Refs:` y el orquestador cierra la issue.
- **Sin referencias a tickets en comentarios de código**: `git blame` → commit → PR → issue ya lleva ahí. Excepciones: `TODO` siempre con su issue; `paid-plan(<decisión>)` con su decisión (D56).
- **Lo comprueba CI** (rompe la PR si falta):
  - Nombre de rama `^(feature|bugfix|hotfix)/\d+-[a-z0-9-]+$` y que el número sea una issue abierta.
  - commitlint: conventional commit y trailer `Refs: #<ticket de la rama>` en cada commit.
  - Cuerpo de la PR con `Ticket #N` (y `PRD #N` si el ticket tiene padre) y etiquetas `type:` y `area:`.
  - Sin `@wip` y sin ficheros temporales (`PROGRESS.md`, `plan.md`, `tasks.md`) en lo que llega a `master` (D52).
  - Etiqueta `size:` en la issue, y `size:L` si el diff toca rutas de zona crítica (D52).
  - Autor de cada commit con el email *noreply* de la cuenta del proyecto: nunca otra cuenta (ver "Arranque").
  - Cada ejemplo de las living specs tiene test (por `@id`) y no hay tests de ejemplos que ya no existen; con eso CI publica el comentario "Verification".
- **Sin constantes de versión a mano** (13 nov 2026): la versión de cada despliegue es el SHA del commit (en `/health` y en Sentry); el cliente web compara además el hash del build de la SPA (D59). Los campos `version` de los `package.json` no se usan.
- **Navegación resultante**: PRD → tickets (sub-issues) → rama y PR (*Development*) → commit en `master` → versión desplegada y release de Sentry; y al revés, desde un error en Sentry o una línea de código hasta el PRD que la motivó.
- Procedimiento `docs/procedures/traceability.md` con los formatos exactos; `pnpm work`, `pnpm plan:sync` y las plantillas de issue y PR los rellenan solos.

### D43 — Repo público
- **Decisión**: el repo es **público**, en la organización gratuita `worKampo`.
- **Por qué** (verificado el 10 nov 2026 en la documentación de GitHub):

| Función | Privado gratis | Público gratis | Privado con Pro o Team (4 $/usuario/mes) |
|---|---|---|---|
| Protección de rama / rulesets | ❌ | ✅ | ✅ |
| Secretos por Environment | ❌ | ✅ | ✅ |
| Required reviewers en Environments | ❌ | ✅ | ❌ (solo Enterprise) |
| Minutos de Actions | ~2.000/mes | sin coste en runners estándar | ~3.000/mes |

  Solo el repo público permite, sin coste, que los agentes no puedan mergear ni desplegar a producción sin la persona (D41).
- **Consecuencias**:
  - **Licencia: ninguna.** Sin fichero `LICENSE`, el código es visible pero todos los derechos quedan reservados (no es open source). Abrirlo (FSL, MIT…) sería una decisión aparte.
  - Repo **`worKampo/workampo`** (decidido el 13 nov 2026). En local vive en `C:\Dev\SaaS\workampo\`, dentro de la carpeta paraguas `C:\Dev\SaaS\` (sin git), junto a `prototype\` (visor del lienzo, fuera del repo). `docs/` pasa al repo en el ticket 1.
  - **Secret scanning y push protection** de GitHub activados, además de gitleaks en pre-commit (D32).
  - **Issues y PRs también son públicas**: nunca datos personales de clientes ni de usuarios (RGPD, D27). Los bugs enlazan a Sentry en lugar de copiar datos.
  - **Vulnerabilidades**: se reportan por *private vulnerability reporting* de GitHub, nunca en una issue pública (`security.txt` lo indicará, D32).
  - Los documentos de diseño (`docs/`) son públicos; no contienen nada sensible.
- **El nombre no protege** (14 nov 2026): un repo público se encuentra igual por búsqueda e índice, se llame como se llame. `workampo` se mantiene en el email, GitHub y Cloudflare. El subdominio de Cloudflare y el email no revelan código, y el JavaScript del navegador es público en cualquier web.
- **Mientras el repo sea público, no entra** ni en código, ni en `docs/`, ni en issues, PRs o mensajes de commit:

| No entra | Dónde va |
|---|---|
| Secretos, tokens, claves, `.dev.vars` | Secretos de Cloudflare y de los Environments (D41) |
| Datos personales de clientes o usuarios, emails reales, nombres de personas | Sentry y la base de datos; las personas, por rol (D45) |
| Estrategia de negocio: precios no publicados, márgenes, clientes reales o potenciales, métricas de negocio, acuerdos comerciales, planes de producto sin anunciar | Repo privado `worKampo/business` (gratis: no despliega nada, no necesita rulesets) |
| Código del producto vertical con valor competitivo propio (reglas del sector, cálculos, integraciones con socios) | Activa el disparador (abajo) |
| Vulnerabilidades sin parchear y detalles explotables de incidentes de seguridad | *Private vulnerability reporting* y *security advisories* privadas; tras el arreglo, un resumen público si aporta |
| Umbrales exactos antiabuso (límites de peticiones, Turnstile) | Variables de entorno, no constantes en el código |
| Source maps publicados con la web | Solo se suben a Sentry |

  - Los identificadores que no dan acceso (Account ID de Cloudflare, nombres de Workers y bindings) sí pueden estar (D45).
  - La seguridad nunca depende de que el código sea secreto: la cubren el security reviewer, los tests de aislamiento y los secretos fuera del repo.
- **Medidas**:
  - Sin `LICENSE`, con aviso en el `README.md`: "© worKampo. All rights reserved. The source is visible but not licensed for any use."
  - Source maps: el build los genera, se suben a Sentry y se borran antes del despliegue. CI falla si el despliegue contiene ficheros `.map`.
  - Secret scanning y push protection de GitHub, más gitleaks en pre-commit (ya decidido).
  - CI falla si el diff contiene emails que no sean del dominio de prueba del seed (`*.test`, `example.com`) ni el *noreply* del proyecto.
- **Alarmas de los agentes**:
  - La lista "No entra" vive en `AGENTS.md` y en `REVIEW.md`. Antes de escribir en el repo, en una issue, en una PR o en un commit, el agente la comprueba.
  - Si algo que se le pide incluir está en la lista, es una **parada obligatoria** (parada 2 de D20: lo publicado en un repo público no se puede retirar). Para, dice qué es y propone dónde va.
  - Un hallazgo de la lista es un fallo que el orquestador resuelve antes del momento 2. CI bloquea lo que detecta solo (secretos, emails, ficheros `.map`). Revisan la lista, vía `REVIEW.md`: en L el security reviewer, en M el spec reviewer y en S CodeRabbit y el orquestador.
  - En el momento 1, el orquestador avisa si un ticket activa el disparador ("este ticket introduce código del vertical con valor propio: D43").
- **Disparador para pasar a privado**: el primer cliente de pago, o el primer código del vertical con valor competitivo propio. Se decide con un ADR entre:
  - **Todo privado con GitHub Team** (unos 4 $ por usuario al mes): mantiene los rulesets. El revisor obligatorio en Environments privados es solo de Enterprise, así que la aprobación de producción pasa a un workflow manual que solo la persona puede lanzar. Verificar los planes en la documentación de GitHub al decidir.
  - **Separar**: la base sigue pública y el vertical va en un repo privado que la consume.

### D44 — Migraciones, datos de referencia, seeds y backfills
| Tipo | Qué es | Entornos | Cómo |
|---|---|---|---|
| **Migración de esquema** | Tablas, columnas, índices | Todos | D33. `pnpm db:migration:new` envuelve `drizzle-kit generate`: el SQL sale del esquema TypeScript (`packages/db/schema/global.ts`, `shard.ts`) y el comando añade las cabeceras (`-- ticket:`, `-- contract:`). El SQL de esquema no se escribe a mano |
| **Datos de referencia** | Lo que el sistema necesita para funcionar: planes, definiciones de flags (los roles están en código, D54) | **Todos, producción incluida** | Migración de datos (`db:migration:new --data`, envuelve `drizzle-kit generate --custom`) con inserts idempotentes escritos a mano. Nunca en seeds |
| **Seed** | Datos de ejemplo: empresas, usuarios, membresías | **Solo local, test y staging** | `pnpm db:seed` |
| **Backfill** | Rellenar o transformar datos existentes (p. ej. el paso Expand de D33) | El que lo necesite, producción incluida | Script en `packages/db/backfills/<date>-<slug>.ts`, idempotente y por lotes; lanzado por un workflow manual con aprobación de la persona, nunca por el despliegue automático |

- **Nombres de migración**: `drizzle-kit` genera nombres aleatorios (p. ej. `0000_powerful_lilandra.sql`); `pnpm db:migration:new` los renombra al formato de D53 (`0007_create_invitations.sql`) antes del commit.
- **Reglas del seed**:
  - Determinista: IDs fijos (UUIDv7 constantes, D53) y fechas fijas; mismos datos en tests, E2E y capturas (D28).
  - Idempotente: se puede ejecutar varias veces sin duplicar.
  - Cubre desde el principio: al menos dos empresas (suite de aislamiento), un usuario en varias empresas, todos los roles, nombres largos y con unicode, una empresa dada de baja.
  - Incluye los usuarios del proveedor de login falso de E2E (D29).
  - En TypeScript sobre el mismo esquema Drizzle: si el esquema cambia, el seed deja de compilar.
  - **Se niega a ejecutarse en producción**, con un test en CI que lo comprueba.
  - Staging: mismo seed más lo que creen las pruebas; se reinicia con un workflow manual.
- **Datos ricos en staging sin datos de clientes** (13 nov 2026). Staging se parece a producción en la forma de los datos, nunca en de quién son. Se consigue por capas:
  - **Seed con casos límite**: las reglas de arriba, ampliadas con textos de derecha a izquierda y una prueba caducada.
  - **Generador de volumen**: `pnpm db:seed --size=large`, con semilla fija (mismo resultado siempre): cientos de empresas y una con miles de miembros, para paginación, rendimiento y límites de D1. Llega con el primer PRD con listas grandes.
  - **Cada fallo de producción alimenta el seed**: si un dato real rompe algo, se reproduce en el seed con su test antes del arreglo, y se anota en `docs/learnings.md`.
  - **Perfil estadístico de producción**: una consulta de solo lectura que devuelve solo cifras agregadas, sin datos personales (miembros por empresa con media, p95 y máximo; longitudes de nombres; alfabetos; idiomas; mezcla de planes; tamaño de las secciones de landing). Ajusta el generador de volumen y se revisa en la revisión mensual (D40). Llega cuando haya clientes reales.
  - **Uso propio**: la persona usa staging a diario como cliente; esos datos se conservan entre despliegues hasta el siguiente reinicio manual.
  - **Aplazado**: copia anonimizada de producción a staging. Solo con ADR y si las capas anteriores se quedan cortas: el texto libre y los JSON son difíciles de anonimizar, sigue siendo tratamiento de datos personales (RGPD, DPA) y hay riesgo de que se pueda volver a identificar a alguien.
- **Reglas del backfill**: por lotes respetando los límites de D1 (100.000 filas escritas/día en Free); idempotente y reanudable; registra su ejecución (entorno, lotes, filas) en la issue del ticket; cabecera `// ticket: #N` (D42).
- **Cuándo llega cada pieza**: infraestructura de seed y de backfills, y los workflows manuales de backfill y de reinicio de staging, en el PRD "Working foundation"; primer esquema, primeros datos de referencia y `db:migration:new` en "Access and first company".

### D45 — Perfil del proyecto (`project.yaml`)
- **Decisión**: `project.yaml` en la raíz del repo con los datos para ubicarse: nombre, repo, tablero, documentos clave, la cuenta y la organización de GitHub del proyecto (las que `pnpm work` exige a `gh` y a git; ver "Arranque"), el Account ID y el subdominio de Cloudflare y, **por entorno** (`local`, `stg`, `prod`), URL, Worker y dashboard de Cloudflare, bindings de D1 y KV, GitHub Environment, Sentry, monitor, WorkOS, modo de Stripe y cuenta de Brevo (una por entorno, D14); las direcciones de correo públicas del dominio cuando exista (D14); lista de servicios (para qué se usan y dónde se administran) y de secretos (nombre y dónde viven).
- `AGENTS.md` lo enlaza en su primera sección; las personas lo leen igual.
- **Reglas**:
  - Nunca secretos: solo su nombre y dónde viven. Repo público (D43): sin emails ni datos personales; las personas, por rol.
  - Sin duplicar configuración: lo que vive en `wrangler.jsonc` (IDs de D1/KV) se nombra y se referencia, no se copia.
  - Se actualiza en la misma PR que cambia la infraestructura o añade un servicio (paso Document, D20); el spec reviewer lo comprueba.
  - `pnpm check` valida su estructura con un esquema Zod (tres entornos, URL por entorno, nada con forma de secreto).
- Lo crea el ticket 4 del PRD "Working foundation" y el ticket 3 rellena los datos reales.

### D47 — Internacionalización desde el inicio
- **Decisión**: toda la interfaz, los emails y el contenido público son multiidioma desde el primer día. **`en` por defecto** y `es` (es-ES); añadir un idioma no requiere tocar código.
- **Idioma activo en la app**: preferencia del usuario → idioma por defecto de la empresa → `Accept-Language` → `en`. No va en la URL de la app (es una preferencia; las URLs siguen siendo compartibles).
- **Páginas públicas** (marketing, ayuda, changelog, legal): idioma en la ruta (`/`, `/es/`) con `hreflang` (D31).
- **Landings de empresa**: en el idioma que elige cada empresa (uno por landing en la v1); el contenido es suyo.
- **Textos**: claves en inglés en el código, ficheros de traducción en el repo; ningún texto visible al usuario escrito en el código. CI falla si falta una clave en algún idioma. Los agentes proponen traducciones y se revisan en la PR.
- **Formatos**: fechas, números y moneda con `Intl`, nunca a mano.
- **Emails** (Brevo): plantilla por idioma, enviada en el idioma del destinatario.
- **Librería**: sin decidir; candidatas Paraglide (compilada, tipada, sin coste en ejecución; sirve a Vite y Astro), Lingui y react-i18next. Se elige y verifica en el Discover de "Access and first company".
- **Sustituye** a la política anterior (UI en español, i18n aplazada) en la visión y D36.

### D48 — Backoffice como Worker separado y límites de la cuenta de Cloudflare
- **Backoffice separado** (seguridad): Worker propio (`bo`, `bo-stg`) con host propio (D6, D11), sobre las mismas bases D1 que la app (no suma bases).
  - Origen distinto: su cookie `__Host-` de sesión es otra; una sesión de empresa nunca vale en el backoffice ni al revés (D8).
  - Login de staff en su propio host, con WorkOS y rol de staff en `DB_GLOBAL`; no pasa por el login central de empresas (D7).
  - CSP y cabeceras más estrictas; despliegue y rollback propios.
  - A valorar en su PRD: **Cloudflare Access** (Zero Trust, gratis hasta 50 usuarios) delante del backoffice. ⚠ Verificar que funciona con hosts de workers.dev.
  - Se crea en el PRD "Staff backoffice", no en "Working foundation".
- **Límites relevantes del plan Free** (documentación de oct 2026):

| Límite | Free | Ámbito | Uso previsto |
|---|---|---|---|
| Workers | 100 | Cuenta | 4 (`app`, `app-stg`, `bo`, `bo-stg`) |
| Peticiones | 100.000/día | **Cuenta** (todos los Workers juntos) | Compartido por entornos, smoke y monitor |
| Bases D1 | **10** | Cuenta | 4 (2 por entorno); margen para 3 shards más por entorno |
| Cron triggers | **5** | **Cuenta** | Ver regla |
| Subpeticiones | 50 por invocación | Petición | Operaciones masivas por lotes |
| Consultas D1 | 50 por invocación (`batch()` = 1) | Petición | Refuerza D10 |

- **Regla de crons**: **un solo cron trigger por Worker** que reparte las tareas internas (limpieza de sesiones y códigos de canje, agregados); las tareas que no necesitan ejecutarse dentro de Cloudflare (copias, reinicio de staging, simulacros, apertura de issues recurrentes) son **GitHub Actions programadas** (sin coste en repo público, D43).
- **Monitor externo**: solo `/health`, cada 5 minutos (≈ 600 peticiones/día entre ambos entornos y ambos Workers).
- ⚠ Verificar si las peticiones a Static Assets cuentan en el cupo diario (la página de precios las daba como gratuitas e ilimitadas; la de límites no lo aclara).

### D49 — Contenido de la plataforma: modelo mixto
- **En el repo, por PR**: ayuda (D25), changelog (D26) y páginas legales (D27). Van ligados al código o a revisiones legales y se actualizan en la misma PR.
- **Web corporativa**: en la v1, Astro dentro del repo (`apps/marketing`). Más adelante, candidata a pasar al **motor de landings de empresa** (D4) como "empresa del sistema", editable desde el backoffice con los mismos drawers: probamos el editor nosotros mismos y no construimos un segundo CMS. Será su propio ticket con ADR.
- **Descartado**: un editor in situ para todo el contenido (como en weCampo): rompe la regla de ayuda y changelog en la misma PR y obliga a construir borradores, versiones y permisos.

### D50 — "Enter as" (impersonación de staff)
- **Decisión**: el backoffice permite al staff entrar en una empresa para dar soporte. Entra en el PRD "Staff backoffice". **Zona crítica**: security reviewer y test designer obligatorios (D30, D32).
- **Reglas**:
  - **Motivo obligatorio** (texto libre, mínimo 10 caracteres) y **duración máxima de 1 hora**, con cuenta atrás.
  - **Solo lectura por defecto.** Modificar algo exige activarlo expresamente durante la sesión, con su propio motivo, y queda marcado en el registro.
  - **Avisos visibles** todo el tiempo en la app (franja en ámbar, como en weCampo) y en el backoffice.
  - **Registro de auditoría**: la sesión (staff, empresa, motivo, inicio, fin, si se activó la escritura y su motivo) en `staff_sessions`, en `DB_GLOBAL`. Lo que cambia durante la sesión va a `audit_events` con el formato común de D53 (`actor_id` = la persona de staff, enlazado a su sesión), en la base donde ocurre cada cambio. Es la primera pieza de auditoría de la v1; el historial de la empresa llega con el primer PRD que lo necesite (D53).
  - **Transparencia**: los administradores de la empresa ven el historial de accesos del staff. La política de privacidad y el DPA lo mencionan (D27).
  - **Mecánica**: el backoffice crea una sesión especial en el host de la app mediante el código de un solo uso de D7, marcada con `impersonated_by`. Nunca reutiliza la cookie del backoffice (D48). Al expirar o al salir, la sesión se revoca.
  - Siempre con confirmación explícita de la persona de staff (D41, acciones irreversibles).

### D51 — Cobros con Stripe Checkout y Customer Portal
- **Los datos de tarjeta nunca pasan por nuestra app**: altas y cambios de plan con pago van por **Stripe Checkout** (página alojada por Stripe); método de pago, facturas y datos fiscales del pagador se gestionan en el **Stripe Customer Portal**. La app solo muestra estado (plan, uso, último pago, facturas enlazadas).
- **El plan cambia cuando llega el webhook firmado de Stripe** (`/api/webhooks/stripe`, firma verificada, D32), nunca cuando vuelve el navegador. La página de vuelta muestra "confirmando" hasta entonces y la empresa recibe también un email.
- Webhooks **idempotentes** (se registran los IDs de evento procesados en `DB_GLOBAL`) y tolerantes al desorden de eventos. Se implementan con el **registro de webhooks** de D53: firma primero, carga validada con Zod, un manejador por evento.
- **Pago fallido** (`past_due`): franja en toda la app para propietarios y admins con "Update payment method" y **periodo de gracia** antes de aplicar los límites del plan inferior. Su duración se fija en el PRD "Plans and billing" (propuesta inicial: 14 días, alineada con los reintentos automáticos de Stripe).
- **Bajar de plan**: se aplica al final del periodo pagado. Si el plan inferior admite menos miembros, la empresa elige quién conserva el acceso; el resto queda en solo lectura (no se borra nada).
- **Subir de plan**: inmediato, con prorrateo de Stripe.
- `plan_level`, los flags del plan, el cliente y la suscripción de Stripe y el estado del pago viven en `DB_GLOBAL` (D9, D53): el webhook se resuelve por el id de cliente sin abrir ningún shard. Solo el webhook los cambia.
- Stripe en **test mode** hasta el lanzamiento (§37). Precios por definir.
- Zona crítica (billing, D22, D30, D32).

### D52 — Solo specs vivas en `master` y flujo por tamaño
> Adoptada el 12 nov 2026 (antes propuesta P-2). D16, D20, D24, D34, D36, D37, D40 y D42 ya están alineadas con ella. Revisada el 14 nov 2026 con los tres momentos de D20: el tamaño ya no cambia los puntos de intervención de la persona.

- **Problema**: cada ticket dejaba en `master` una carpeta congelada (`intent.md`, `spec.md`, `plan.md`, `tasks.md`, `verification.md`) que se desactualiza al día siguiente y nadie relee; y el ciclo pesaba igual para un ajuste de texto que para la sesión.
- **Permanente en `master`**: visión, specs vivas (`docs/domains/<domain>.md`), ADRs, `docs/design/`, `docs/platform.md`, `AGENTS.md`, `REVIEW.md`, roles, `GLOSSARY.md`, `docs/learnings.md` y contenido de producto (ayuda, legal, changelog). No existen `docs/prds/` ni `docs/fixes/`.
- **Temporal**:

| Pieza | Dónde vive |
|---|---|
| PRD (con hipótesis opcional) | Cuerpo de la issue `type:prd` |
| Intent del ticket | Cuerpo de la issue del ticket |
| Cambio de reglas (change spec) | Los ejemplos se aprueban en la issue (momento 1, D20); en la rama se editan directamente en la spec viva y el diff de la PR es la change spec. El spec reviewer comprueba que coincide con lo aprobado |
| `plan.md`, `tasks.md`, `PROGRESS.md` | Ficheros separados en la rama; `pnpm work pr` los borra al abrir la PR, en el mismo commit; el plan pasa a un comentario **"Plan"** de la PR, las tareas siguen en la checklist de la issue y el estado en el comentario "Progress" (D16). Ningún temporal llega a `master` (CI rechaza la PR si existe alguno) y no hace falta un commit tras la aprobación, que podría invalidarla |
| Verificación | Comentario "Verification" de la PR, generado por CI |

- **Marcas en la spec viva** (etiquetas Gherkin):
  - `@wip(#n)` en las reglas nuevas o cambiadas mientras se trabaja en la rama; nunca llega a `master` (CI lo rechaza).
  - Al abrir la PR pasa a `@issue(#n)`: **una por regla** (bloque `Rule:`), no por ejemplo; indica la última issue que la cambió. El detalle fino lo dan `git log` y los trailers.
  - Lo que está en construcción en todo el producto se ve en el tablero y en `pnpm work status`, no en `master`.
- **Ejemplos con identificador estable**: en la issue se numeran en local (E1, E2…); `pnpm specs:ids` asigna el definitivo al escribirlos en la spec viva, con formato `<dominio>-<issue>-<n>` (`@id:companies-15-1`), que nunca choca entre tickets en paralelo. Cada test cita el identificador de su ejemplo; CI falla si hay ejemplos sin test o tests de ejemplos que ya no existen, y con eso genera la matriz de verificación. Nadie la escribe a mano.
- **Dominios en lugar de áreas**: las antiguas áreas mezclaban dominios, una superficie (`backoffice`), mecanismos técnicos (`flags`, `platform`) y contenido (`content`, `legal`), y eso dejaba reglas con dos casas posibles. Las specs vivas se agrupan solo por dominio (contexto de negocio con reglas y vocabulario propios):

| Spec viva | Incluye | Sustituye a |
|---|---|---|
| `access` | Login, sesión, códigos de un solo uso, acceso de staff ("Enter as": motivo, duración, auditoría) | `auth` y parte de `backoffice` |
| `companies` | Ciclo de vida de la empresa, slug, ajustes, miembros y roles, invitaciones, propiedad, borrado | `companies`, `members` y parte de `backoffice` |
| `billing` | Planes, límites y flags de plan, pagos, gracia, cambios de plan | `billing` y `flags` |
| `public-site` | Landing de empresa: secciones, publicación, SEO, contenido de la empresa | `landings` |

  - Fuera de las specs vivas: `backoffice` no es dominio (aplica reglas de otros dominios; la salud del sistema es operación); `platform` es documentación de operación (`docs/platform.md` y runbooks); el mecanismo de `flags` es técnico y lo que permite cada plan va en `billing`; `content` y `legal` son contenido del producto (D49), y lo que sea regla (p. ej. la supresión de datos, D27) va al dominio afectado.
  - **Regla de propiedad**: una regla vive en el dominio que posee el dato o la decisión, aunque la pantalla esté en otra superficie ("solo un propietario puede borrar la empresa" va en `companies`). Prueba: "¿cómo funciona X?" se responde con un único fichero.
  - **Crece por división**: cuando un dominio supera unas 300 líneas pasa a carpeta (`docs/domains/companies/team.md`, `invitations.md`…), cuando duele y no por adelantado.
  - **Etiquetas de GitHub**: los dominios (`area:access`, `area:companies`, `area:billing`, `area:public-site`) tienen spec viva y el spec reviewer exige actualizarla si cambia el comportamiento; `area:platform`, `area:content` y `area:backoffice` son etiquetas de apoyo que solo filtran el tablero.
- **Molde de la spec viva**: Purpose · Rules (reglas con ejemplos Gherkin) · Terms (enlaces a `GLOSSARY.md`) · Out of scope. Solo comportamiento observable: nada de tablas, endpoints ni librerías.
- **Publicación de las specs vivas** (13 nov 2026): de momento se comparten con el enlace de GitHub (el repo es público). Cuando haya specs con contenido real y alguien a quien enseñarlas, un chore monta la **documentación viva**: web estática generada desde `docs/domains/` (Astro + Starlight) con el estado del test de cada ejemplo (por `@id`), publicada gratis (GitHub Pages o un Worker con Cloudflare Access si el repo pasa a privado). Separada de la ayuda de clientes (D25) y siempre generada, nunca copiada a otra herramienta.
- **Tamaño del ticket** (lo propone el slicer, o el agente en tickets sueltos, y lo confirma la persona en la issue):

| Tamaño | Ejemplos | Recorrido del agente | Revisión automática |
|---|---|---|---|
| **S** | Bug acotado, texto, ajuste visual, hotfix | El momento 1 es la propia issue; issue → rama → PR, con las tareas como checklist de la issue; un bug empieza por su test de regresión | CI, CodeRabbit y un paquete de verificación reducido del verificador |
| **M** | Funcionalidad normal, sin tocar modelo de datos, contratos de API ni migraciones (si los toca, pasa a L) | Sin Design ni `plan.md` (el plan cabe en `tasks.md`): ejemplos aprobados → spec viva y escenarios de aceptación → tareas → PR | + test designer, escenarios protegidos (obligatorios), spec reviewer y UI/UX si aplica |
| **L / zona crítica** | Sesión, aislamiento, billing, migraciones, secretos | Los once pasos de D20, con `plan.md` | + sección Security y security reviewer, nivel `max` (D22) |

- **Hotfix**: sigue el recorrido S, pero si toca una ruta de zona crítica lleva los revisores de L (test designer y security reviewer).

- **La persona interviene igual en todos los tamaños**: los tres momentos de D20 (pedir, comprobar, publicar). El tamaño decide cuánto trabajo y revisión automática hay antes del momento 2, no cuántas veces para la persona.

- **Cómo se clasifica**: tres preguntas en orden; gana la primera que se cumpla.
  1. ¿Toca una zona crítica (sesión, aislamiento, migraciones, billing, secretos), el modelo de datos, un contrato de API o una migración? → **L**.
  2. ¿Añade o cambia reglas de negocio (ejemplos Gherkin de la spec viva) o introduce un patrón o componente de interfaz nuevo (nivel 3, D31)? → **M**.
  3. Si no → **S**: bug que devuelve el comportamiento que la spec ya describe, textos, ajustes visuales, chores sin cambio de comportamiento.
  - Casos frontera: un bug que revela una regla no escrita es **M** (hay que añadirla a la spec viva). Muchos cambios S juntos siguen siendo S: el tamaño mide riesgo y proceso, no horas.
- **Cuándo**: en los tickets de un PRD, en el slicing (P2, D34); en los sueltos (bugs, chores), al crear la issue, con una línea de justificación del agente. La persona lo confirma: sin tamaño confirmado el ticket no pasa a Ready (Definition of Ready, D34) y `pnpm work start` no arranca.
- **Dónde**: etiqueta de la issue `size:S`, `size:M` o `size:L`; se ve y se filtra en el tablero, y la leen `pnpm work status` y CI.
- **Si cambia por el camino**:
  - **Subir** lo puede hacer el agente en cualquier momento: si descubre que el ticket toca algo de la pregunta 1, cambia la etiqueta, lo anota en "Decisions made" y sigue el recorrido de L desde el paso en que esté. Solo para si el motivo es una parada obligatoria de D20 (p. ej. una zona crítica que la spec no cubre).
  - **Red de seguridad en CI**: si el diff toca rutas de zona crítica (migraciones, sesión, billing, secretos; lista en `docs/procedures/critical-paths.md`) y la etiqueta no es `size:L`, la PR falla y pide reclasificar.
  - **Bajar** solo lo decide la persona.

- **`plan.md` solo en L y zonas críticas**; en S y M el plan cabe en `tasks.md`.
- **Comandos `pnpm work`** (un script con subcomandos en `scripts/work/`; los usan igual la persona y los agentes; un `/work` de Claude Code solo los reenvía):

| Comando | Qué hace | Cambia algo |
|---|---|---|
| `pnpm work` | Ayuda: acciones disponibles y, en una rama de ticket, el siguiente paso sugerido | No |
| `pnpm work status [#n…]` | Sin números: todo lo que está en curso (ramas con `PROGRESS.md`, PRs abiertas, issues en curso), una línea por issue con tamaño, paso, tareas y siguiente. Con números: el detalle (tareas, preguntas abiertas, CI, enlaces). `--json` para agentes y CI | No |
| `pnpm work resume [#n]` | Retomar: sin número, deja elegir entre lo que está a medias; comprueba que no hay cambios sin guardar, cambia de rama e imprime el resumen en el orden de lectura de D16 | Cambia de rama |
| `pnpm work start #n` | Crea la rama, `PROGRESS.md` y la checklist de la issue | Sí |
| `pnpm work inbox` | Solo lo que espera a la persona: ejemplos por aprobar (momento 1), PRs con paquete de verificación listas (momento 2), despliegues a producción en pausa (momento 3) y paradas obligatorias abiertas, cada uno con su enlace. `--json` para otros scripts | No |
| `pnpm work verify #n` | Momento 2 (D20): crea o actualiza el worktree de la rama, reinicia la base local con el seed, arranca la app, abre el navegador e imprime la lista de prueba del paquete de verificación | Solo en local (worktree y base local) |
| `pnpm work pr` | Comprueba `pnpm check`, pasa `@wip` a `@issue`, publica el comentario "Plan" si hay `plan.md`, borra los temporales, hace commit, push y abre la PR con el cuerpo rellenado | Sí |
| `pnpm work close` | Cierra la issue sin preguntar; el agente propone el aprendizaje, si lo hay, en el comentario de cierre | Sí |

  - `status` no crea otra fuente de verdad: solo lee `PROGRESS.md`, el comentario "Progress", la checklist de la issue y el tablero.
  - Reglas comunes: repetibles sin duplicar nada si se cortan a mitad, `--dry-run`, fallos con mensaje claro, sin credenciales propias (usan la sesión de `git` y `gh`, D41).
  - Sin comandos para mover tarjetas ni editar tareas a mano: eso lo hacen `start`, `pr` y `close`, y el workflow de despliegue mueve las tarjetas a Staging, Release y Done (D37).
  - Se construyen en el chore 5 de "Working foundation" junto a `specs:ids`, `plan:check`, `plan:sync`, `db:seed`, `db:backfill` y el check de CI de los escenarios de aceptación (orden de commits y `/reopen-acceptance`, D30).
- **Aprendizajes** en `docs/learnings.md` (en inglés, en `master`):
  - `AGENTS.md` obliga a leer la sección general y la de cada dominio que toque el ticket.
  - Formato fijo de 1–3 líneas: cuándo aplica · regla · porqué · enlace a la PR o issue.
  - Entran al cerrar un ticket (propuestos en el comentario de cierre), cuando un error se repite o tras un postmortem. El agente añade el aprendizaje a la siguiente PR que abra, y la persona lo ve en su momento 2; si en una semana no hay ninguna, abre una PR `docs:` pequeña.
  - Salen cuando se convierten en un control automático (lint, test, check de CI) o en una línea de `AGENTS.md`.
  - Límite de unas 100 líneas: si se supera, se poda o se convierte.
- **Resultados (outcome-driven, versión mínima)**: el PRD puede llevar una hipótesis en su issue; si la tiene, al cerrarlo se añade un comentario "Outcome review" (D34). Nada de esto va a la spec viva. Señal por ticket, paso de revisión de resultados aparte, criterio de retirada y experimentos con flags: descartados por ahora.
- **Ritual**: revisión mensual de 15 minutos (D40): métricas automáticas de GitHub y CI, poda de `learnings.md` y roadmap.
- **Trazabilidad** (D42): se apoya en issue → rama → PR, los trailers y las etiquetas `@issue`; no hay frontmatter de tickets ni de PRDs que validar.

### D53 — Convenciones de código
> Decidida el 13 nov 2026. Detalle operativo en `docs/process/code-conventions.md` (ticket 4 de "Working foundation"), enlazado desde `AGENTS.md`. Lo que se pueda comprobar lo comprueban Biome y dependency-cruiser en `pnpm check` (D17).

- **Organización por dominio, no por capas técnicas**: el nivel superior de `src/` de cada app son **directamente los dominios** (los mismos que `docs/domains/`, D52), sin carpeta intermedia: rutas, casos de uso, acceso a datos, esquemas y tests juntos. Lo común va en **`src/_shared/`**: el guion bajo lo ordena primero y marca que no es un dominio (única excepción al `kebab-case`). Regla: toda carpeta de `src/` es un dominio salvo `_shared/`. Un caso de uso por fichero.
  ```
  apps/api/src/
    _shared/
      http/problem-json.ts · tenancy/resolve-tenant.ts · ids/new-id.ts
      email/ · payments/ · auth/ · error-tracking/   adaptadores (ver abajo)
    access/
    billing/
    companies/
      routes.ts · routes.int.test.ts · errors.ts
      invitations/
        invite-member.ts · invite-member.test.ts
        invitation-repo.ts        acceso a datos con tenant_id obligatorio
    public-site/
    env.ts · index.ts
  apps/web/src/companies/members/
    members-page.tsx · member-drawer.tsx · use-members.ts · members-page.test.tsx
  ```
- **Núcleo de dominio puro** (14 nov 2026, D57): lo que no hace E/S y deben compartir la API, la web y la futura app móvil (esquemas Zod, reglas, permisos, códigos de error, valores como `Email` o `Slug`) vive en `packages/domain/<dominio>/`, con las mismas carpetas de dominio. En `apps/api` quedan rutas, casos de uso y repos; en `apps/web`, pantallas y hooks. Por eso los esquemas Zod de las invitaciones (`invitation-schemas.ts`) viven en `packages/domain/companies/invitations/` y no en el árbol de arriba.
- **Fronteras** (dependency-cruiser): un dominio no importa el interior de otro dominio (solo lo que este exporta en sus rutas o casos de uso); `_shared/` no importa de ningún dominio; `packages/domain` no importa Hono, Drizzle, React, `fetch` ni nada de `apps/`; los hooks de datos de la web no usan el DOM.
- **Nombres**:

| Qué | Convención | Ejemplo |
|---|---|---|
| Ficheros y carpetas | `kebab-case` | `invite-member.ts`, `member-drawer.tsx` |
| Tests (D29) | mismo nombre + sufijo | `invite-member.test.ts`, `routes.int.test.ts` |
| Componentes React | `PascalCase`, fichero en kebab | `MemberDrawer` en `member-drawer.tsx` |
| Hooks | `use` + camelCase | `useMembers` |
| Funciones y variables | `camelCase`; verbo para acciones | `inviteMember()`, `pendingInvitations` |
| Booleanos | `is` / `has` / `can` | `isOwner`, `hasSeatsLeft`, `canInvite` |
| Tipos | `PascalCase`, sin prefijo `I` | `Invitation`, `InviteMemberInput` |
| Esquemas Zod | camelCase + `Schema`; el tipo se infiere | `inviteMemberSchema` → `z.infer<…>` |
| Constantes | `UPPER_SNAKE_CASE` | `INVITATION_TTL_DAYS` |
| Exports | siempre con nombre; sin `export default` | `export function inviteMember…` |
| Paquetes internos | `@workampo/…` | `@workampo/db`, `@workampo/ui` |
| Tablas y columnas | plural, `snake_case` | `invitations`, `tenant_id`, `expires_at` |
| IDs | UUIDv7 sin prefijo; tipo con marca en TypeScript | `CompanyId`, `UserId` |
| Migraciones (D33, D44) | número + verbo + objeto | `0007_create_invitations.sql` |
| Rutas de la API | plural, kebab-case | `POST /api/t/:slug/invitations/:id/resend` |
| Códigos de error | `dominio.motivo` | `companies.invitation_expired` |
| Claves de i18n (D47) | `dominio.pantalla.elemento` | `companies.members.invite_button` |
| Eventos de analítica (D38) | `object_action` | `member_invited` |
| Variables y bindings | `UPPER_SNAKE_CASE` | `DB_GLOBAL`, `SENTRY_DSN` |

  Una regla se sigue de punta a punta con el mismo nombre: `docs/domains/companies.md` (`@id:companies-15-1`) → `accept-invitation.ts` → `accept-invitation.test.ts` (cita `companies-15-1`) → error `companies.invitation_expired` → texto `companies.invitations.expired`.
- **Base de datos**: tablas en plural y `snake_case`; `tenant_id` en toda tabla de empresa (D10); sin borrado lógico salvo donde el producto ofrezca deshacer o restaurar (ver "Estados y borrado"). Además (13 y 14 nov 2026):
  - **Nombres de tabla por el concepto del dominio** (14 nov 2026): si la relación tiene nombre en el glosario, ese (`members`, `invitations`, `subscriptions`), nunca el de las tablas que une (`company_users`). Solo un enlace técnico sin nombre propio usa `<entidad>_<entidades>` (`company_tags`); una extensión 1:1, `<entidad>_<aspecto>` en plural (`company_profiles`, `member_preferences`). Un nombre de tabla existe en una sola base.
  - **Columnas y tipos**:

| Tema | Regla |
|---|---|
| Clave primaria | `id` UUIDv7 sin prefijo, generado por la app, cuando la fila se pide por URL o API o la referencian otras tablas (`companies`, `users`, `members`, `invitations`); la unicidad de negocio, en un índice aparte. Clave compuesta en las extensiones 1:1 y en los enlaces que nunca se piden sueltos (`member_preferences (tenant_id, user_id)`, `company_profiles (tenant_id)`). En el shard la clave es `id` solo, no `(tenant_id, id)` |
| Referencias | `<entidad>_id` en singular (`user_id`); la empresa es siempre `tenant_id`; entre bases, solo el ID y sin clave foránea (D10) |
| Booleanos | `is_` / `has_` (`is_active`) |
| Instantes y fechas | `_at` para instantes (texto ISO en UTC); `_on` para fechas sin hora (`renews_on`) |
| `created_at` | En todas las tablas, en UTC. La pone la app, no la base (los valores por defecto de fecha difieren entre motores) |
| `updated_at`, `updated_by` | En las tablas que editan personas; la primera vez coinciden con la creación. `updated_by` es el usuario o la persona de staff |
| Autor | Sin `created_by` genérico (sale de `audit_events`). Solo autores con nombre de dominio donde el producto los muestra: `invited_by`, `published_by`, `uploaded_by` |
| `status` | Solo en tablas con ciclo de vida, con los valores del dominio (`draft` / `published`, `pending` / `accepted` / `expired`, `trialing` / `active` / `deleting`) y `CHECK` |
| Enumerados | Texto con `CHECK` de valores permitidos, sin números mágicos |
| JSON | Solo si la estructura es libre (secciones de la landing, D4): texto validado con Zod al leer y escribir |
| Dinero | `amount_cents` (entero) + `currency` |
| Emails | Columna normalizada en minúsculas con índice único |
| Nulos | `NOT NULL` por defecto; nulable solo si el vacío significa algo (`accepted_at` de una invitación pendiente) |
| Longitudes | Validadas con Zod (SQLite no las limita) |

  - **Índices y unicidad**: nombres `idx_<tabla>__<columnas>` y `uq_<tabla>__<columnas>`; toda columna de referencia indexada; en tablas de empresa los índices empiezan por `tenant_id`; unicidad por empresa cuando corresponde (`uq_members__tenant_id_user_id`).
  - **Concurrencia**: columna `version` (entero) en lo que se edita en pantalla (ajustes, página pública…); la escritura lleva `WHERE version = ?` y, si no actualiza nada, la interfaz avisa de que otra persona lo cambió. Lo atómico en un único `batch()` (D10).
  - **Estados y borrado** (14 nov 2026): borrado real por defecto, con su evento en `audit_events`. Borrado lógico solo donde el producto ofrece deshacer o restaurar (toast con "Deshacer", `patterns.md`), como un valor del propio `status` (`archived` o `deleted`, con `deleted_at`): el repo filtra esos valores por defecto, los índices únicos son parciales (`WHERE status <> 'deleted'`) y un Workflow purga de verdad a los N días (D56). Así se evita que un filtro olvidado muestre datos borrados, que un slug o email borrado bloquee su reutilización y el choque con el derecho de supresión (D27).
  - **Historial (`audit_events`)** (14 nov 2026): tabla solo de añadir, sin modificar ni borrar: `id`, `tenant_id`, `actor_id` (usuario o staff), `action` (`companies.member_role_changed`), `target_type`, `target_id`, `changes` (JSON con solo los campos cambiados, antes → después), `request_id`, `created_at`.
    - **Cada base registra sus propios cambios en el mismo `batch()`** que el cambio, así son atómicos: los de acceso (miembros, invitaciones, facturación, staff) en `DB_GLOBAL`; los de negocio, en el shard. El historial de una empresa junta los dos por `tenant_id`.
    - Se escribe desde el repo con un helper que añade el evento al `batch()`; sin triggers (no se ven en el código y no pasan bien a Postgres).
    - Datos personales mínimos en `changes` (ids, no emails ni nombres copiados) y nunca secretos; la retención la fija D27.
    - Cuándo: `updated_at` y `updated_by` desde la primera tabla (rellenarlos después es imposible); `audit_events`, con la auditoría de staff de D50 y, para la empresa, con el primer PRD que necesite historial (probablemente "Team").
  - **Consultas**: siempre a través del repo del dominio; columnas explícitas, nunca `SELECT *`; toda lista con tamaño máximo de página; sin consultas en bucle (N+1).
  - **Migraciones**: una migración, un cambio; nunca se edita una ya aplicada (D33, D44).
  - **Qué va en cada base** (14 nov 2026). Regla: en `DB_GLOBAL` va lo que hace falta **antes** de saber en qué shard está la empresa o **entre** empresas; en el shard va todo lo que la empresa crea y usa dentro de su espacio. Cada tabla se declara en `schema/global.ts` o en `schema/shard.ts` (D9, D10).

| `DB_GLOBAL` | Por qué |
|---|---|
| Usuarios, sesiones, códigos de un solo uso (D7) | La identidad es una aunque la persona esté en varias empresas |
| Preferencias de la persona (idioma, tema, emails) y aceptaciones legales (D27) | Son de la persona, no de una empresa |
| Registro de empresas: id, slug, shard, estado (activa, en prueba, dándose de baja), **nombre y logo** | Resolver la empresa desde la URL antes de tocar un shard (D5); el selector de empresas y las listas del backoffice no abren un shard por empresa. Nombre y logo viven solo aquí, sin copia en el shard |
| `members` (usuario, empresa, rol, D54) e `invitations` | Datos de acceso: sesión, empresa y rol se leen en una sola base en cada petición; aceptar una invitación es un único `batch()` |
| Facturación: plan, cliente y suscripción de Stripe, estado del pago (D51) | Los webhooks de Stripe llegan sin contexto de empresa y se resuelven por el id de cliente; el plan fija los límites (plazas = miembros) |
| Planes y flags, staff (`staff_members`, D54), auditoría de staff (D50), webhooks procesados (D51) | Son del sistema |

| Shard de la empresa | Ejemplos |
|---|---|
| Perfil y ajustes de la empresa | Datos fiscales, zona horaria, idioma por defecto: Ajustes › General salvo nombre, slug y logo |
| Página pública (D4) | Secciones, textos, SEO y estado de publicación; KV guarda el HTML generado |
| Ajustes de cada miembro en esa empresa | Qué notificaciones quiere de esa empresa (`tenant_id` + `user_id`, sin clave foránea a `users`, D10) |
| Notificaciones del panel | Cada una pertenece a una empresa |
| Trabajo asíncrono (D56) | `jobs`, `idempotency_keys` |
| Metadatos de ficheros subidos (`files`; los ficheros, en R2, D62) | Documentos, imágenes de la empresa |
| Datos de negocio del vertical | Todo lo que construya el producto encima de la base |
| Auditoría de la empresa (futura) | Qué hizo cada miembro |

  - **Por qué**: mover una empresa de shard (o al shard Postgres futuro, D10) es copiar sus filas con su `tenant_id` y cambiar el puntero del registro. `DB_GLOBAL` se queda pequeña y con tablas que cambian poco. Cada petición hace como máximo dos consultas: global (sesión, empresa, rol y plan) y, si hace falta, el shard.
  - **Borrar una empresa** toca dos bases sin atomicidad (D27): 1) se marca "dándose de baja" en el registro, lo que corta el acceso al momento; 2) un Workflow (D56) borra los datos del shard; 3) se borra lo de global. Si algo falla a mitad, el Workflow reintenta y la empresa sigue sin acceso.
  - **Nombres en Drizzle**: camelCase en TypeScript (`expiresAt`) y snake_case en la base (`expires_at`), con la opción `casing: 'snake_case'` de Drizzle; los nombres no se escriben dos veces.
  - **Límites de D1**: cada consulta admite un número limitado de parámetros (100 según la documentación) y cada `batch()` tiene un tamaño máximo. Las operaciones con listas largas (invitar 50 emails, borrados masivos) las trocea el repo por dentro.
  - **Búsqueda de texto**: sin distinguir mayúsculas mediante una columna normalizada en minúsculas, no con `COLLATE NOCASE` (no se comporta igual en Postgres); comodines de `LIKE` escapados (lección del proyecto anterior).
  - **Orden alfabético**: por la columna normalizada; el orden según idioma (acentos, ñ) lo hace la interfaz con `Intl`.
  - **Tests**: cada test de integración arranca con la base limpia y las migraciones aplicadas (almacenamiento aislado de `@cloudflare/vitest-plugin`), con datos de las factorías de D29.
  - Las réplicas de lectura de D1 quedan fuera hasta que un ADR las justifique (D9).
- **Fechas y dinero**: UTC en base de datos y API (ISO 8601); dinero en enteros (unidades menores) más la moneda; formateo solo en la interfaz con `Intl` (D47).
- **Errores**: errores de dominio tipados (`errors.ts` de cada dominio), traducidos a HTTP en un único sitio (`_shared/http/problem-json.ts`) con formato *problem+json* (RFC 9457) y un `code` estable que la interfaz traduce.
- **Imports**: paquetes internos por nombre (`@workampo/…`); sin ficheros barril que reexportan todo; sin ciclos (dependency-cruiser).
- **Validación y tipos**: Zod solo en las fronteras (entrada a la API, formularios, variables de entorno); tipos inferidos de Zod y Drizzle, nunca duplicados a mano.
- **Configuración**: bindings y variables tipados y validados al arrancar (`env.ts`); nada de leer variables sueltas por el código.
  - Secretos locales solo en `.dev.vars` (ignorado por git); se sube `.dev.vars.example` con los nombres y sin valores. Secretos de staging y producción con `wrangler secret` y en los GitHub Environments (D13).
  - Configuración pública por entorno en `vars` de `wrangler.jsonc`. Sin ficheros `.env.<entorno>`.
- **Estilos**: solo tokens (`docs/design/tokens.css`) y clases de Tailwind de la escala; sin valores arbitrarios (`text-[20px]`) fuera de `packages/ui`.
- **Componentes de interfaz: componentizar todo lo posible, en tres niveles** (13 nov 2026):

| Nivel | Dónde | Qué | Reglas |
|---|---|---|---|
| **Global** | `packages/ui` | Primitivos (shadcn adaptado: botón, campos, diálogo, drawer, tabla, badge, tooltip…) y compuestos genéricos (tabla de datos, drawer de detalle, confirmación con "DELETE", barra de filtros, vistas guardadas, cabecera de página, KPI, estados vacío/error/carga, paleta de comandos, shell y sidebar) | Sin conocimiento del negocio: datos y textos por props, sin pedir datos al servidor; accesibles; con tests de componente; documentados en `docs/design/components.md` |
| **Compartido de la app** | `apps/<app>/src/_shared/components/` | Conocen la app pero no un dominio: selector de empresa, menú de usuario, barra de uso del plan, banner de staff | Sin lógica de un dominio concreto |
| **De funcionalidad** | Dentro de su dominio (`src/companies/members/member-drawer.tsx`) | Combinan componentes globales con los datos y reglas del dominio | Finos: sin estilos propios ni presentación repetida |

  - **Promoción**: lo que ya está en el sistema de diseño se hace global desde el primer día. Lo que nace en una funcionalidad se queda en su dominio hasta el **segundo uso real**, y entonces sube a `_shared/` o a `packages/ui` en la misma PR. No se generaliza con un solo uso.
  - **Cómo se detecta**:
    1. **Al reutilizar**: dependency-cruiser impide que un dominio importe componentes de otro, y `packages/ui` no importa de ninguna app. El segundo uso rompe `pnpm check` y obliga a promover.
    2. **Al copiar en lugar de importar**: un detector de código duplicado (jscpd) revisa los `.tsx` en CI y avisa en la PR (aviso, no bloqueo, al principio).
    3. **Antes de crear**: en Specify el diseñador UI/UX nombra los componentes del catálogo que usa la pantalla y marca los patrones nuevos (`docs/design/README.md`); `AGENTS.md` obliga a buscar en `packages/ui` y en `components.md` antes de crear uno; `REVIEW.md` incluye "componente nuevo parecido a uno existente".
- **Logs**: estructurados (JSON) con id de petición y de empresa, sin datos personales; errores a Sentry a través de su adaptador (D39), que envía con `ctx.waitUntil` para no perder eventos cuando el Worker responde antes de terminar el envío.
- **Portabilidad de la base de datos** (para un posible shard Postgres, D10):
  - Un único punto da el cliente de base de datos de una empresa (`_shared/tenancy/`); los `*-repo.ts` lo reciben y nunca usan el binding de D1 directamente.
  - Consultas con el constructor de Drizzle; nada de SQL propio de SQLite en los repos (`strftime`, funciones JSON de SQLite, `ROWID`, `AUTOINCREMENT`). Si algo específico hace falta, queda aislado y comentado en el repo que lo usa.
  - Tipos portables: IDs generados por la app, fechas ISO en UTC, dinero en enteros, booleanos explícitos en el esquema.
  - No se construye ahora la capa de dos motores: solo se evita lo que la haría cara después.
- **Registro de webhooks**: cada proveedor que envía webhooks (Stripe, D51) tiene un registro evento → manejador en su adaptador, con un test que comprueba que cada evento está registrado una sola vez. Orden fijo: verificar la firma, validar la carga con Zod, comprobar idempotencia (IDs procesados en `DB_GLOBAL`) y llamar al caso de uso.
- **Comentarios**: en inglés y solo para el porqué; nunca repiten lo que dice el código. Los rodeos por límites de planes gratuitos llevan la marca `paid-plan` (D56).
- **Dependencias externas, concentradas en un solo sitio**:
  - **Servicios y librerías de proveedor** (WorkOS, Stripe, Brevo, Sentry, analítica, APIs de Cloudflare que no son la base de datos): siempre detrás de un **adaptador propio por capacidad**, nombrado por lo que hace y no por el proveedor (`_shared/auth/`, `_shared/payments/`, `_shared/email/`, `_shared/error-tracking/`). Expone tipos propios, nunca los del proveedor, y tiene su versión falsa para tests. Un cambio de versión o de proveedor queda dentro de su adaptador.
  - **Frameworks de base** (Hono, React, Zod, Drizzle, router y librerías de estado del frontend): se usan directamente; son el idioma del código y envolverlos no aporta. Excepción: los componentes de interfaz se importan solo de `packages/ui` (shadcn adaptado, `docs/design/`), que actúa de adaptador.
  - **Utilidades** (fechas, IDs, dinero, slugs): helpers propios en `_shared/` sobre lo que da la plataforma (`Intl`, `crypto`), sin librería salvo que haga falta.
  - **Se hace cumplir**: dependency-cruiser fija, por cada paquete de proveedor, la única carpeta que puede importarlo; importarlo desde otro sitio rompe `pnpm check`. Toda dependencia nueva se clasifica en la PR: de proveedor (nace con adaptador y regla) o de base (con motivo).
  - Los adaptadores viven en `apps/<app>/src/_shared/<capacidad>/` mientras los use una sola app; si los necesitan varias (p. ej. el backoffice, D48), pasan a `packages/integrations/`.
- **Se decide más adelante**, con el primer PRD que lo use: router, estado del servidor y formularios del frontend (al montar la SPA); paginación, filtros y orden de la API (con la primera lista); uso de feature flags en el código (con el primer flag real, D9).

### D54 — Roles y permisos
- **Decisión** (13 nov 2026): roles fijos en código y permisos como un mapa de acciones en código. Sin tablas `roles`, `permissions` ni `role_permissions`. **Zona crítica** (aislamiento y acceso): security reviewer y test designer obligatorios (D30, D32).
- **Por qué**: en el proyecto anterior el catálogo de permisos vivía en la base, sincronizado desde WorkOS, y ningún código lo consultaba; la única comprobación real leía el rol de staff del JWT, así que un cambio de rol no se aplicaba hasta que caducaba la sesión, y el rol "solo lectura" no se aplicaba en ningún sitio.
- **Roles de empresa**: `owner`, `admin`, `member`, en `members.role` (texto con `CHECK`, D53). Roles a medida por empresa solo con su propio ADR, si un cliente grande lo pide.
- **Permisos**: un mapa en código de acción → roles permitidos (`'members.invite': ['owner', 'admin']`), en el dominio `companies`, y una sola función `can(member, action)`. La API es la autoridad; la interfaz usa la misma función solo para mostrar u ocultar. Un test unitario recorre toda la matriz de roles por acciones (D29).
- **Matriz inicial**:

| Acción | Owner | Admin | Member |
|---|:-:|:-:|:-:|
| Usar la app y salir de la empresa | ✓ | ✓ | ✓ |
| Invitar, cambiar de rol y quitar admins y members | ✓ | ✓ | |
| Página pública y ajustes generales | ✓ | ✓ | |
| Ver facturación (plan, uso, facturas) | ✓ | ✓ | |
| Cambiar plan y método de pago (D51) | ✓ | | |
| Hacer owner a alguien, quitar o degradar owners, transferir la propiedad | ✓ | | |
| Borrar la empresa | ✓ | | |
| Ver el historial de accesos del staff (D50) | ✓ | ✓ | |

- **Siempre al menos un owner**: puede haber varios. La regla se comprueba en el dominio y la escritura va en un único `batch()` que la vuelve a comprobar; si dos owners se quitan el rol a la vez, uno recibe `companies.last_owner`. El único owner no puede salir ni borrar su cuenta sin transferir antes la propiedad (D27).
- **Cambios de rol al instante**: el rol se lee de la base en cada petición, junto con la membresía que ya se carga al resolver la empresa. Nunca del JWT ni de una caché de sesión.
- **Interfaz**: lo que el rol no permite no aparece. Deshabilitado con tooltip solo cuando el motivo no es el rol (único owner) o en una sesión de staff de solo lectura (D50). Una página entera sin permiso muestra el estado "Sin acceso" (`docs/design/patterns.md`).
- **Staff**: tabla propia en `DB_GLOBAL` (`staff_members`), separada de los roles de empresa. Un solo rol ahora, `admin`; `support` se añade cuando entre la primera persona de soporte. Las altas y bajas de staff las hace la persona con un script (🧑), sin pantalla.
- **Staff en "Enter as"** (D50): en solo lectura ve lo mismo que un owner. Con la escritura activada actúa como owner salvo en una lista de acciones prohibidas: borrar la empresa, transferir la propiedad y cambiar plan o pago. Todo queda en la auditoría de D50.

### D56 — Trabajo asíncrono
- **Decisión** (14 nov 2026): el patrón se diseña ahora y se construye con el primer caso real (probablemente la exportación o el borrado de los datos de una empresa, D27).
- **Por qué**: en Workers Free el límite que pesa es el **CPU: 10 ms por invocación**; esperar a la base de datos, a `fetch` o a KV no cuenta. Una petición HTTP no tiene límite de duración mientras el cliente siga conectado, `ctx.waitUntil()` alarga hasta 30 s tras responder, y cron y consumidores de cola tienen 15 min de duración. Pasar trabajo a segundo plano da duración, fiabilidad y reintentos, **no más CPU**: cada paso sigue con su límite. Fuente: documentación de límites de Workers, consultada el 14 nov 2026.
- **Qué patrón usar**:

| Trabajo | Patrón | Ejemplo |
|---|---|---|
| Rápido y con mucha espera de E/S (lo normal) | Síncrono | Guardar ajustes, invitar 50 emails en lotes (D53) |
| Accesorio, puede perderse | `ctx.waitUntil()` tras responder | Sentry, analítica |
| Largo, con varios pasos o que no puede perderse | **Workflow** de Cloudflare: estado por paso, reintentos del paso que falla, esperas | Exportar o borrar una empresa, importar un CSV |
| Mucho cálculo | En el navegador si se puede (leer el CSV, reducir la imagen antes de subirla); si no, Workers Paid (5 $/mes) con ADR | Generar un PDF |

  - **La API valida siempre**, aunque el navegador ya lo haya hecho: el navegador no es de fiar. Lo que cambia es el tamaño de cada envío: el navegador lee el fichero entero y manda lotes pequeños (p. ej. 500 filas) que la API valida con Zod dentro de su presupuesto de CPU.

  - Workflows antes que una cola simple: guardan el estado de cada paso y reintentan solo lo que falló. Una cola queda para mucho volumen repartido. ⚠ Verificar si Queues entra en el plan gratuito antes de usarla.
- **Contrato**:
  - El trabajo largo responde `202 Accepted` con el id del trabajo; el estado se consulta en `GET /api/t/:slug/jobs/:id`.
  - Tabla `jobs` en el shard: `tenant_id`, `type`, `status` (`queued` / `running` / `succeeded` / `failed`), `progress`, referencia al resultado, `error_code`, `created_by`. La interfaz la lee aunque el Workflow guarde su propio estado.
  - Cabecera `Idempotency-Key` en los `POST` que crean algo: un reintento devuelve el mismo resultado sin duplicar (clave por empresa y usuario, en la tabla `idempotency_keys` del shard, que caduca a las 24 h).
- **Aviso a la interfaz**, en este orden: consultar `GET /api/t/:slug/jobs/:id` con espera creciente (cada consulta cuenta en las 100.000 peticiones diarias); notificación en la app al terminar, y email si tarda; tiempo real con Durable Object y WebSocket solo si hace falta; push en móvil con su adaptador (D57). Patrón de interfaz en `docs/design/patterns.md`.
- **Vigilancia**: el p99 de CPU por ruta se sigue en las métricas del Worker y avisa al acercarse a 10 ms (D39). Es la señal para mover el cálculo al navegador o pasar a Workers Paid con ADR.
- **Marcas `paid-plan`** (14 nov 2026): todo rodeo que existe solo por un límite de un plan gratuito (CPU de Workers, filas diarias de D1, escrituras de KV, cuotas de Sentry, Brevo u otros) lleva una marca en el código o en la configuración, para volver a él cuando se pague:
  ```ts
  // paid-plan(D56): CSV parsed in the browser and sent in batches of 500.
  // Upgrade: on Workers Paid, parse and validate the whole file in a Workflow step.
  ```
  - **Formato fijo**: `paid-plan(<decisión>):` qué rodeo hay y por qué, y una línea `Upgrade:` con qué cambiar al pagar. En inglés, como todos los comentarios (D53). Es la única marca de deuda permitida sin issue propia: la decisión citada hace de referencia.
  - **La fuente es el código**: `pnpm debt` lista todas las marcas (fichero, línea, decisión, rodeo y mejora); no hay otra lista que mantener.
  - **CI** comprueba el formato (decisión existente y línea `Upgrade:`); una marca mal formada rompe `pnpm check`.
  - **Los agentes** añaden la marca siempre que implementan un rodeo por un límite gratuito, y lo anotan en "Decisions made" (D20); el spec reviewer marca como fallo un rodeo sin marca.
  - **Revisión mensual** (D40): número de marcas por decisión. Al pasar a un plan de pago, su ADR crea un ticket por cada marca afectada.
  - Lo que no está en el código (repo privado, D43) sigue con su propio disparador.

### D57 — Preparado para una app móvil
- **Decisión** (14 nov 2026): no se escribe código móvil, pero todo se construye sabiendo que existirá una app que comparte con la web y la API todo lo posible. Cuando llegue: **opción A**, web con Vite y shadcn, y app con Expo, compartiendo todo menos los componentes visuales. Descartada una única base Expo para web y móvil: pierde shadcn y empeora la web, sobre todo en accesibilidad.
- **Ya previsto**: una sola API (D6, D19) con cliente Hono RPC basado en `fetch`, que también funciona en móvil; sesión por `Authorization: Bearer` en móvil (D8); dominios separados (D52, D53); IDs generados por la app (D53); cada pantalla con URL propia (enlaces profundos).
- **Se hace desde ya**:
  1. **Núcleo de dominio puro en `packages/domain/<dominio>/`**: esquemas Zod, reglas de negocio, permisos (`can`, D54), códigos de error y valores como `Email`, `Slug` o `Money`. Sin entrada ni salida de datos: dependency-cruiser le prohíbe importar Hono, Drizzle, React o `fetch`. Lo importan la API y la web, y lo importará la app móvil (D53).
  2. **La API solo evoluciona añadiendo** (D19): campos y endpoints nuevos sí; quitar o cambiar el significado, solo tras un periodo de transición, como expand/contract en las migraciones (D33). Una app instalada llama a la API con su versión vieja durante meses. Cabecera de versión mínima y pantalla de "actualiza la app" llegan con la app.
  3. **La sesión se resuelve en un solo middleware** que acepta cookie o Bearer (D8); ahora solo se implementa la cookie.
  4. **Los hooks de datos de la web no tocan el DOM**: la lógica de pedir y guardar datos queda separada de los componentes (regla de lint), para moverla a un paquete compartido cuando llegue la app.
  5. **Los tokens de diseño tendrán una fuente portable** (TS o JSON) de la que salga el CSS; se hace cuando llegue la app.
- **DDD y hexagonal, en versión ligera**:

| Sí | No |
|---|---|
| Lo estratégico: dominios como contextos separados, lenguaje común (`GLOSSARY.md`), cada regla en el dominio que posee el dato (D52) | Una interfaz y una capa por cada cosa con una sola implementación |
| Núcleo puro: reglas como funciones sin E/S, probadas con tests unitarios simples | Buses de comandos y eventos, inyección de dependencias hecha a mano |
| Casos de uso finos en la API: cargan con el repo, llaman a las reglas puras y guardan en un `batch()` | Eventos de dominio, hasta que haya trabajo asíncrono que los necesite (D56) |
| Agregados con nombre donde hay una regla que se cumple siempre (empresa y miembros: siempre un owner, D54) | Hexagonal completo de manual |
| Puertos solo donde se cambia algo de verdad: proveedores (adaptadores de D53) y el repo de datos | |

  Lección del proyecto anterior: tenía la ceremonia (CQRS, inyección manual, interfaces de una implementación) sin la separación real del dominio.
- **Para el ADR de la app**: qué se comparte (tipos de la API, esquemas, permisos, reglas, traducciones y formatos, hooks de datos, tokens) y qué no (componentes visuales, navegación); login con WorkOS en móvil (verificar flujo nativo); push; modo sin conexión (D2).

### D58 — Herramientas de los agentes y del repo
- **Decisión** (14 nov 2026): los agentes consultan documentación actual antes de usar una API externa, con herramientas asignadas por rol y en solo lectura. El repo usa las herramientas gratuitas de GitHub y pnpm para seguridad y dependencias.
- **Orden para consultar documentación**: 1) la fuente oficial del proveedor (su MCP o su `llms.txt`); 2) Context7; 3) búsqueda web. Siempre con la versión instalada en el repo. Context7 es un agregador: útil como respaldo, con cobertura y frescura variables y con cuota.
- **Herramientas por rol**:

| Herramienta | Para qué | Roles |
|---|---|---|
| MCP oficiales de Cloudflare (documentación, observabilidad, builds) | Documentación de Workers, D1 y Workflows; logs y métricas en la ventana de observación (D20) | Researcher, verificador |
| Sentry MCP | Errores tras la release; contexto de un bug | Verificador; implementador en bugs |
| Stripe (MCP o documentación) | Checkout, Portal y webhooks; datos en modo test | Researcher; implementador en `billing` |
| shadcn MCP (oficial) | Explorar e instalar componentes del registro en `packages/ui`, respetando `components.md` | Implementador de interfaz |
| Playwright MCP | Explorar la app en local y staging; preparar el paquete de verificación | Verificador, UI/UX |
| Chrome DevTools MCP | Rendimiento, consola y red de una página real | Verificador, cuando hay dudas de rendimiento |
| DeepWiki o GitMCP | Preguntas sobre el código de un repo público (Hono, Drizzle, SDK de WorkOS) cuando la documentación no basta | Researcher (opcional) |
| `llms.txt` de Hono y Drizzle | Documentación completa sin intermediario | Todos |
| `gh` CLI | Issues, PRs y CI; gasta menos contexto que el MCP de GitHub | Todos |

  - ⚠ Verificar si WorkOS tiene MCP oficial; mientras tanto, su documentación por `llms.txt` o Context7.
  - **Por rol**: cada MCP ocupa contexto con la definición de sus herramientas; se configuran en la definición de cada rol (`.claude/agents/`, D21).
  - **Solo lectura**: nunca un MCP que modifique recursos, despliegue o use claves de producción (D41). Stripe, solo en modo test.
  - **Nunca secretos ni datos de clientes en las consultas** (lista de D43).
- **Configuración del repo** (gratis por ser público, D43):

| Pieza | Qué aporta |
|---|---|
| CodeQL | Análisis de seguridad en cada PR |
| Dependabot (solo alertas de seguridad) | Aviso cuando una dependencia tiene una vulnerabilidad |
| Renovate | PRs de actualización de versiones agrupadas y programadas, revisadas por el agente como cualquier otra |
| pnpm `minimumReleaseAge` | No instala versiones publicadas hace menos de unos días (protección frente a paquetes maliciosos recién subidos) |
| pnpm `onlyBuiltDependencies` | Solo ejecutan scripts de instalación los paquetes de una lista |
| Knip en `pnpm check` | Ficheros, exports y dependencias sin usar |
| OpenSSF Scorecard | Puntuación de seguridad del repo, revisada en la revisión mensual (D40) |
| Hooks de Claude Code | Hacen cumplir técnicamente lo que hoy es instrucción: el implementador no edita `e2e/acceptance/` (D30) ni escribe algo de la lista de D43 |

  - ⚠ Socket.dev (detección de paquetes sospechosos): comprobar si su plan gratuito cubre el repo antes de añadirlo.
- **Descartado**: buscadores web con IA (Exa, Perplexity: ya hay búsqueda web y serían otra cuenta y cuota), el MCP de GitHub (`gh` hace lo mismo), escáneres de seguridad de pago.

### D59 — Versión del cliente web
- **Decisión** (14 nov 2026): la SPA (app y backoffice) sabe con qué versión del código trabaja, detecta cuando hay otra desplegada y se actualiza sin romperse ni perder cambios.
- **Por qué**: cada versión del Worker solo sirve sus propios ficheros estáticos (documentación de Cloudflare, consultada el 14 nov 2026). Quien tiene abierta la versión anterior sigue ejecutando su JavaScript; la API nueva le sirve (D19), pero al cargar bajo demanda el código de otra pantalla (`members-a1b2.js`) recibe un 404 y la pantalla se rompe.
- **Qué versión compara el cliente: el hash del build de la SPA**. El Worker se identifica por el SHA del commit (D42), en `/health` y en Sentry. Un despliegue de `app` que no cambia la SPA (p. ej. solo la web corporativa o la ayuda) no recarga a nadie; como solo se despliegan los Workers afectados (D60), un cambio en el backoffice tampoco.

| Pieza | Regla |
|---|---|
| Versión en el build | La SPA lleva el hash de su build (`import.meta.env.VITE_APP_VERSION`) y lo envía en cada llamada con `X-Client-Version`; logs, Sentry y analítica lo registran |
| Versión en la API | Cada respuesta lleva `X-App-Version` con el hash del build de la SPA que sirve ese Worker: el cliente detecta la versión nueva sin peticiones extra |
| Recarga al navegar | Con versión nueva detectada, el siguiente cambio de pantalla es una recarga completa a la misma URL |
| Cambios sin guardar | Nunca se recarga con la barra de guardar visible (`patterns.md`); se espera a que la persona guarde o descarte |
| Fichero que no carga | Error al cargar código bajo demanda → una sola recarga (marca en `sessionStorage` para no entrar en bucle); si vuelve a fallar, página de error con su referencia |
| Pestaña abierta mucho tiempo | Banner discreto "Hay una versión nueva · Recargar" |
| Versión mínima (emergencia) | La API puede responder `X-Min-Client-Version`; un cliente más antiguo ve un diálogo que bloquea: "Recarga para continuar". Solo para un fallo de seguridad o un cambio que no pudo ser solo aditivo (D19) |
| Caché | `index.html` sin caché; ficheros con hash `immutable`. Sin service worker |

- **Encaje**: base de datos compatible con la versión anterior (D33) → API que solo añade (D19) → cliente web que se actualiza en minutos (D59) → app móvil con versión mínima y pantalla de "actualiza la app" (D57). Las páginas públicas de Astro no lo necesitan.
- **Cuándo**: el registro de `X-Client-Version`, en el ticket 3 de "Working foundation"; `X-App-Version` y la parte del cliente, al montar la SPA (primer PRD con interfaz), porque antes no hay build de la SPA que comparar.
- **Tests**: unitario de la lógica que decide si recargar; integración que comprueba las cabeceras de versión de la API; E2E que simula una versión nueva y comprueba que la siguiente navegación recarga sin perder cambios sin guardar.

### D60 — Despliegue por Worker afectado
- **Decisión** (14 nov 2026): cada despliegue incluye solo las piezas afectadas, no todo. Desplegar todo cambiaría la versión de cada Worker en cada despliegue y recargaría a todos los usuarios de la app aunque solo hubiera cambiado el backoffice (D59).
- **Piezas que se despliegan**:

| Pieza | Contenido | Por qué va junta |
|---|---|---|
| Migraciones | `DB_GLOBAL` y shards (`packages/db/migrations`) | Las comparten todos los Workers |
| Worker `app` | API + SPA + landings de empresa + web corporativa y ayuda (`apps/marketing`, D12) | Comparten tipos (Hono RPC, D19) y origen (D6) |
| Worker `bo` | Backoffice (D48) | — |

- **Cómo se decide**:
  1. Se compara con **lo desplegado en ese entorno** (el SHA de cada `/health`), no con el commit anterior: varios merges desde el último despliegue cuentan juntos.
  2. **Turborepo** calcula las apps afectadas desde el grafo del monorepo: un cambio en `packages/domain` o `packages/ui` afecta a sus consumidores; lockfile, configuración raíz y `wrangler.jsonc` se declaran dependencias globales y afectan a todo.
  3. **Migraciones siempre primero** si cambió algo en `migrations/`, aunque no se despliegue ningún Worker (D13, D33).
  4. **Producción recibe solo lo probado en staging**: calcula su propio diff contra los SHA desplegados en producción, hasta el SHA ya validado en staging. Así no se pierde nada aunque producción vaya varios despliegues por detrás.
- **Versiones por Worker**: cada Worker lleva el SHA con el que se construyó (`app` en `a1b2` y `bo` en `c3d4` es correcto). Pueden convivir porque los Workers no se llaman entre sí y la base es compatible con la versión anterior (D33). D59 solo recarga a los usuarios de la app si cambió el build de la SPA; un cambio solo de la web corporativa redespliega `app` sin recargar a nadie.
- **Redes de seguridad**:
  - Workflow manual **"desplegar todo"** (🧑) para dudas o recuperación.
  - El smoke se ejecuta siempre **contra todos los Workers**, desplegados o no, para detectar efectos cruzados.
  - Rollback por Worker (`wrangler rollback`) con su runbook; una migración no se deshace, se corrige hacia delante (D33).
  - Los comentarios "Staging verification" y "Release verification" dicen qué se desplegó y con qué SHA.

### D62 — Ficheros: R2, imágenes y PDFs
- **Decisión** (14 nov 2026): los ficheros (logos, avatares, documentos, PDFs generados) se guardan en **R2**, privados, detrás del adaptador `_shared/storage/` (D53). Se construye con el primer PRD que lo necesite (probablemente el logo de la empresa en "Access and first company" o "Company public site").
- **Dónde**:
  - Un bucket por entorno: `files-stg` y `files-prod` (D13). R2 no cobra la salida de datos; el plan gratuito incluye unos 10 GB al mes (confirmar en la página oficial).
  - Claves por dueño: `t/<tenant_id>/<tipo>/<file_id>.<ext>` para lo de una empresa; `u/<user_id>/avatar/<file_id>.webp` para lo de una persona.
  - Metadatos en la base del dueño (D53): tabla `files` en el shard (nombre, tipo, tamaño, `uploaded_by`, `status`); el logo y el avatar, como referencia en `companies` y `users` de `DB_GLOBAL`, porque los usa el selector de empresas.
  - En local y en tests, `wrangler dev` y Vitest simulan R2: no hace falta un falso propio del adaptador.
- **Subir**:
  - Imágenes y documentos pequeños (hasta unos 10 MB), **a través del Worker**: sesión, permiso (`can`, D54), tamaño y tipo real (por sus primeros bytes, no por la extensión), y guardado en R2.
  - Las imágenes se preparan en el navegador antes de subir: redimensionadas (avatar 256 px, logo 512 px), convertidas a WebP con `canvas` y **sin metadatos EXIF**, que pueden llevar la ubicación GPS (D56: el cálculo pesado, en el navegador).
  - Ficheros grandes, en el futuro: URL firmada para subir directo a R2 (API S3, con un token de R2 como secreto), solo cuando haga falta.
- **Servir**:

| Tipo | Cómo |
|---|---|
| Privado (documentos de la empresa) | Ruta `/api/t/:slug/files/:id`: comprueba el permiso y devuelve desde R2 con caché `private` |
| Público (logo en la landing, avatares) | Ruta pública con caché `immutable`; al cambiar el fichero cambia su `file_id` y la URL |
| Temporal (enlace en un email, exportación) | URL que firma el propio Worker con caducidad (p. ej. 24 h); se comprueba la firma antes de servir |

- **Tamaños y formatos**: sin miniaturas por adelantado; la versión normalizada que sube el navegador basta para avatares y logos. Si hacen falta varios tamaños (imágenes de la landing), transformaciones de Cloudflare Images sobre R2: el plan gratuito incluye 5.000 transformaciones únicas al mes. Con un juego fijo de tamaños (64, 256, 512, 1200) y `format=auto` (AVIF o WebP). Al superarlas, las cacheadas siguen funcionando y las nuevas fallan sin cobrar: el código sirve la original y lleva su marca `paid-plan` (D56).
- **PDFs generados**: en el navegador cuando los pide el usuario (`pdf-lib` o la impresión con hoja de estilo de impresión). Si tienen que generarse en el servidor (adjunto a un email), Workers Paid o Browser Rendering, con ADR y marca `paid-plan`. Los temporales (exportaciones, D27) van a `t/<tenant_id>/exports/` con una regla de caducidad de R2 que los borra a los 7 días.
- **Seguridad**:
  - Solo tipos permitidos por categoría: PNG, JPEG, WebP y PDF. **Nunca SVG ni HTML subidos por usuarios** (pueden ejecutar código en nuestro dominio).
  - Al servir: `Content-Type` fijado por nosotros, `X-Content-Type-Options: nosniff` y `Content-Disposition: attachment` para lo que no sea imagen.
  - Espacio por empresa sumado desde `files`, para los límites del plan (`billing`).
  - Borrado: al borrar una empresa, el Workflow de D53 vacía el prefijo `t/<tenant_id>/`; al borrar una cuenta, `u/<user_id>/` (D27).
- **Librerías**: casi ninguna. El binding de R2; `canvas` y `createImageBitmap` del navegador; `aws4fetch` solo con subidas directas a R2; `pdf-lib` solo cuando haya PDFs generados.

### D63 — Residencia de datos en la UE
- **Decisión** (14 nov 2026): todo lo que guarda datos vive en la UE desde el primer día, en staging y en producción por igual. Varias de estas opciones se eligen al crear el recurso o la cuenta y no se pueden cambiar después.

| Servicio | Qué guarda | Decisión |
|---|---|---|
| D1 | Usuarios, empresas, datos de negocio | `wrangler d1 create --jurisdiction eu`: se ejecuta y guarda solo en la UE. No se puede cambiar tras crearla |
| R2 (D62) | Ficheros | `wrangler r2 bucket create --jurisdiction eu` |
| Sentry | Errores y trazas | Organización en la región UE (Fráncfort), mismo precio en todos los planes; se elige al crearla y no se cambia. Algunos metadatos de cuenta pueden quedar en EE. UU. |
| PostHog (si se elige, D38) | Eventos sin datos personales | Su nube UE (verificar al darse de alta) |
| WorkOS | Email y nombre (D8) | ⚠ Sin documentación oficial encontrada sobre región UE: confirmarlo con WorkOS antes de "Access and first company". Si no la hay, lo que reciben ya es mínimo (empresas, roles y sesiones están en nuestra base) y se cubre con su contrato de tratamiento de datos y las cláusulas estándar de la UE; el adaptador `_shared/auth/` (D53) permite cambiar de proveedor si un cliente exige más |
| Brevo | Emails de destinatarios | Empresa europea |
| Stripe | Datos de pago (nunca pasan por nosotros, D51) | Su filial europea |

- **Lo que no se puede limitar a la UE en el plan gratuito**, con su regla:
  - **KV** se replica en todo el mundo: nunca datos personales (solo el HTML público de las landings).
  - **Workers y Workflows** procesan en el centro de datos más cercano al usuario (limitarlo a la UE es de planes Enterprise): los parámetros de los Workflows llevan solo ids, nunca datos personales.
  - **Logs y Sentry**: sin datos personales en los eventos (ids, no emails), con la limpieza de datos de Sentry activada.
- **Política de privacidad (D27)**: lista de subencargados (Cloudflare, WorkOS, Stripe, Brevo, Sentry y, si se elige, PostHog) con su ubicación y las garantías de las transferencias internacionales.
- **Quién lo comprueba**: el script de aprovisionamiento crea D1 y R2 siempre con `--jurisdiction eu` y falla sin ella; la revisión de seguridad (D32) comprueba que nada personal va a KV, a los parámetros de los Workflows ni a los logs.

### D64 — Secretos locales
- **Decisión** (14 nov 2026): un gestor de contraseñas personal como único sitio de lo que haya que guardar, y el mínimo posible de secretos en disco. Aplica desde el ticket 1; D55 se apoyará en él.
- **Gestor**: Bitwarden gratis, cuenta personal, con una carpeta "worKampo". **Nunca un gestor corporativo**: lo administra otra organización, se pierde al dejarla y mezcla lo del proyecto con lo ajeno (D43, "Arranque"). 1Password personal sería válido, pero cuesta unos 3 $ al mes.
  - Alta con el **email personal, no con el Gmail del proyecto**: el gestor guarda la contraseña de ese Gmail, y depender el uno del otro para recuperarse dejaría sin salida si se pierde uno.
  - Contraseña maestra larga y solo memorizada; 2FA con app de autenticación; **código de recuperación de Bitwarden impreso y guardado fuera del ordenador**.
- **Cada secreto en su sitio**:

| Secreto | Dónde vive |
|---|---|
| Contraseñas, 2FA y códigos de recuperación de las cuentas | Gestor |
| Clave privada de la GitHub App de los agentes | `%USERPROFILE%\.workampo\github-app.pem`, fuera del repo y con permisos solo para el usuario de Windows; copia en el gestor. Un script la usa para obtener **tokens de instalación de 1 hora**, que son los que usan los agentes; nunca un token permanente |
| Tokens de administración (GitHub para rulesets, Cloudflare para crear recursos) | Ningún sitio: se crean con caducidad de un día, se pasan como variable de entorno en esa terminal, se usan y se revocan. Los scripts los leen de la variable, fallan sin ella y nunca la imprimen |
| Tokens de despliegue por entorno | GitHub Environments (D41), pegados con `gh secret set --env stg` desde la entrada estándar, sin fichero intermedio; en el gestor, solo su ficha (permisos, caducidad), sin el valor |
| Usuarios de prueba de WorkOS en staging | Secretos del Environment `stg` (D29) |
| `.dev.vars` | Local, ignorado por git, casi vacío (login, Stripe y emails son falsos en local) |
| Clave SSH | Una por equipo, con passphrase, en el agente SSH |

- **Los agentes no leen la clave de la App**: regla "deny" en `.claude/settings.json` sobre `~/.workampo/**`. Es una barrera de configuración (los agentes usan el mismo usuario de Windows); si se filtrara, el daño queda acotado a los permisos mínimos de la App (D41) y se rota.
- **Nunca un secreto en el chat de Claude, en una issue o en un commit** (D41, D43): si un comando pide un valor, lo escribe la persona en la terminal. gitleaks y la push protection son la red de seguridad.
- **Rotación**: la clave de la App, una vez al año o ante cualquier duda; los tokens de despliegue, con caducidad (p. ej. 90 días) y un runbook para renovarlos.

### D61 — Panel local del harness (aplazado, a tener en cuenta)
> Estado: **propuesta para el futuro** (14 nov 2026), no forma parte del PRD "Working foundation". Mientras tanto, `pnpm work inbox` y el campo "Espera a" del tablero (D37, D52). Se retoma cuando haya varios tickets en paralelo o cueste ver qué hay en cada sitio.

- **Qué es**: `pnpm work ui`, una página **solo local** que arranca con un comando, lee las mismas fuentes que `pnpm work` (`gh`, ficheros del repo, `/health` de cada Worker, `pnpm work status --json`) y nunca se despliega. Página sencilla servida por el propio script, sin build ni dependencias nuevas.
- **Dónde se ve** (14 nov 2026): el comando arranca un servidor Node en `scripts/work/` y abre el navegador en `http://127.0.0.1:<puerto>/?t=<token>`; existe mientras la terminal siga abierta. Puerto configurable en `project.yaml` (D45). Se puede abrir también en el panel de navegador de la app de Claude. Desde el móvil no se ve: para eso, el tablero de GitHub filtrado por "Espera a". En otro equipo (D55) es el mismo comando, sin nada que sincronizar.
- **Seguridad local**: escucha solo en `127.0.0.1`, nunca en `0.0.0.0`; token aleatorio generado al arrancar, exigido en cada petición; las acciones van por `POST` con ese token y el servidor rechaza peticiones con una cabecera `Host` distinta de la suya. Así ninguna página web abierta en el navegador puede lanzar comandos llamando a `localhost`.
- **Bloques**:

| Bloque | Qué muestra |
|---|---|
| Te espera a ti | Lo de `pnpm work inbox`: momentos 1, 2 y 3 pendientes y paradas obligatorias abiertas |
| En curso | Tickets con tamaño, paso, última entrada del "Work log" y bloqueos |
| Entornos | SHA de cada Worker en staging y producción, último despliegue y resultado del smoke |
| CI | Últimas ejecuciones y su duración frente al objetivo de D13 |
| Salud del proceso | Métricas de D40 |
| Deuda y avisos | Marcas `paid-plan` (D56), tamaño de `learnings.md`, comprobaciones ⚠ pendientes |
| Configuración, en lectura | Etiquetas, rulesets y Environments declarados frente a los reales de GitHub: avisa si alguien cambió algo a mano |

- **Vista "Historia"** (lo que se hizo; 14 nov 2026):

| Vista | Qué muestra | De dónde sale |
|---|---|---|
| Por PRD | Tickets, PRs, versiones en producción (SHA y fecha), "Outcome review" si tenía hipótesis y aprendizajes que dejó | Sub-issues, PRs, comentarios "Release verification" y "Outcome review" (D34) |
| Por regla de la spec | Por qué la regla es así: las issues que la cambiaron, con su intent y sus ejemplos aprobados | `@issue(#n)` y `git log` de `docs/domains/` (D42, D52) |
| Línea de tiempo | Despliegues, decisiones (ADRs) y aprendizajes por fecha | Workflow de despliegue, `docs/adr/`, `docs/learnings.md` |
| Cómo fue el proceso | Por ticket: tamaño, rondas, paradas y tiempo de cada momento | Comentarios "Work log" (D40) |

- **Vista "Preparado"** (lo que viene): roadmap por PRD con su avance; tickets que cumplen la Definition of Ready frente a los que no, y por qué; lo aplazado y las comprobaciones del Backlog.
- Las dos son de solo lectura, se calculan desde GitHub y git con una caché local (para no agotar el límite de la API) y no guardan nada nuevo. Tienen sentido cuando haya varios PRDs cerrados. Si se monta la documentación viva de D52, cada regla puede enlazar también a las issues que la cambiaron.

- **Puede**: abrir el paquete de verificación, lanzar `pnpm work verify #n`, comandos de solo lectura o con `--dry-run`, y abrir el fichero o la issue correspondiente.
- **No puede**: mergear, aprobar PRs ni aprobar producción (solo enlaza a GitHub); cambiar rulesets, Environments ni secretos (scripts de la persona con su token, D41); editar configuración (es código y va por PR). Corre con el `gh` del proyecto, el mismo que pueden usar los agentes: si el panel pudiera aprobar, un agente también podría.
- **Distinto de "System health"** del backoffice (D39): aquel muestra la salud de producción al staff; este es herramienta de desarrollo y no sale de la máquina.

### D46 — Herramientas para la documentación (aplazado, a tener en cuenta)
> Estado: **propuesta para el futuro**, no forma parte del PRD "Working foundation". Se retoma cuando el volumen de documentación lo justifique.

- **Obsidian** como lector y editor opcional de la persona: abrir el repo (o `docs/`) como vault; vista de grafo, Properties sobre el frontmatter, Bases para tablas filtradas (p. ej. ADRs por estado), backlinks, Mermaid nativo.
  - Enlaces markdown estándar con rutas relativas, **nunca `[[wikilinks]]`** (GitHub, Starlight y agentes no los entienden).
  - Nada de sintaxis de plugins dentro de `docs/`; vistas `.base` y notas personales fuera de `docs/` o ignoradas.
  - `.obsidian/` en `.gitignore`; commits siempre con git normal (lefthook y checks).
- **Graphify** como acelerador opcional de los agentes: grafo de conocimiento del código y los documentos (`graphify-out/`, ignorado en git) para Discover, análisis de impacto en Design y detección de documentos huérfanos. Nunca dependencia: sin él, los agentes leen los ficheros como siempre (D15). Probarlo sobre `docs/` antes de incluirlo en el harness.
- **Calidad del markdown en `pnpm check`**: markdownlint, comprobador de enlaces (lychee) y validación del frontmatter de `docs/adr/`.

### D55 — Trabajar en varios equipos (aplazado, a tener en cuenta)
> Estado: **propuesta para el futuro** (14 nov 2026), no forma parte del PRD "Working foundation". Se retoma antes de empezar a trabajar en un segundo equipo. Solo cubre a la persona en varios equipos; la entrada de otro developer queda fuera.

- **Principio**: un equipo nuevo queda listo con un solo script y casi sin secretos en disco.

| Qué | Cómo se sincroniza |
|---|---|
| Código y docs | Git: pull al empezar, push al terminar. `PROGRESS.md` va commiteado (D16), así que el trabajo a medias pasa de un equipo a otro |
| Secretos de desarrollo local (`.dev.vars`) | Fuente única en el gestor de D64 (Bitwarden, con CLI); `pnpm secrets:pull` regenera `.dev.vars` y avisa si falta una clave de `.dev.vars.example` |
| Accesos (`gh`, `wrangler`, SSH) | No se copian: se dan de alta en cada equipo (`gh auth login`, `wrangler login`, una clave SSH por equipo, todas en la cuenta de GitHub). Si se pierde un equipo, se revoca solo ese |
| Lo que vive fuera del repo | Repo privado `worKampo/business` (fijado en D43; carpetas a decidir al retomarlo) con el prototipo y un script de arranque idempotente |

- **Pocos secretos locales**: con el login falso, los servicios falsos y los emails capturados, el desarrollo local funciona casi sin secretos reales. Los de staging y producción no están en ningún equipo: viven en Cloudflare y en los Environments de GitHub (D41). Nunca secretos cifrados en el repo público.
- **Script de arranque** (`setup.ps1`): instala Node (`.nvmrc`) y pnpm con Corepack; escribe la identidad de git por carpeta (`includeIf` con el *noreply*, `hooksPath`, alias SSH); genera la clave SSH del equipo y muestra la pública; lanza `gh auth login`, `wrangler login` y el login del gestor de contraseñas; ejecuta `pnpm secrets:pull` y `pnpm doctor`.
- **`pnpm doctor`** en el repo: comprueba versión de Node, autor de git con el *noreply*, cuentas de `gh` y `wrangler` según `project.yaml`, hooks instalados y claves de `.dev.vars`; si algo falla, dice el comando que lo arregla.
- **Lo que deben saber los agentes va en el repo** (`AGENTS.md`, `docs/learnings.md`, `.claude/` sin rutas personales), no en la memoria local de cada equipo, que no se sincroniza.
- **Aviso**: si uno de los equipos es corporativo, revisar antes su política (propiedad de lo creado en él y visibilidad para la empresa); como mínimo, sin secretos ni notas de negocio en ese equipo.

---

## Propuestas en estudio (no decididas)

### P-1 — Plantillas globales que se copian a cada empresa (13 nov 2026)
- **Idea**: contenido de partida en `DB_GLOBAL` que cada empresa recibe y personaliza en su shard. Candidatos: secciones y temas de la página pública (D4), textos de emails y notificaciones, valores por defecto de ajustes, catálogos de un vertical, listas de onboarding. No aplica a roles (D54).
- **Tres tipos que no se mezclan**:

| Tipo | Dueño | Dónde vive | Ejemplo |
|---|---|---|---|
| Dato de referencia (D44) | El sistema; la empresa solo lo lee | `DB_GLOBAL` | Planes, definiciones de flags |
| Plantilla que se copia | La empresa, desde la copia | Origen en global, copia en el shard | Sección de landing, texto de email |
| Plantilla con ajustes por empresa | El sistema, con cambios de la empresa | Global + tabla de ajustes en el shard | Catálogo grande que casi nadie modifica |

- **Regla práctica**: pequeño y personalizable → se copia; grande y casi sin cambios → se referencia con ajustes; del sistema → dato de referencia.
- **Encaje con lo decidido**:
  - El origen se guarda como texto (`template_id`, `template_version`), sin clave foránea entre bases (D10). La versión permite ofrecer "hay una versión nueva" con su diff, sin forzar.
  - La copia cruza dos bases y no es atómica: idempotente, única por empresa y plantilla (`uq_<tabla>__tenant_id_template_id`).
  - Se copia en el primer uso, no al crear la empresa.
  - Copiar catálogos grandes multiplica filas por shard (límite de tamaño de D1).
  - Actualizar copias a la fuerza es un backfill (D44), con aprobación de la persona.
- **Empresa plantilla** (cómo se editan): una empresa del sistema que se edita con la app normal, como la web corporativa de D49. "Publicar plantilla" (🧑, desde el backoffice) genera una instantánea con versión en `DB_GLOBAL`. Las empresas nuevas copian de la instantánea, nunca de la empresa viva: así no se copian estados a medio editar ni se cruzan shards. Solo se copian las tablas permitidas (nunca miembros, facturación, auditoría ni invitaciones) y los IDs se generan de nuevo, también dentro de los JSON. No es un seed: los seeds nunca llegan a producción (D44).
- **Demo para clientes potenciales**:
  - **Ahora**: demo guiada por la persona en una empresa normal de producción marcada `is_demo` (D29).
  - **Con el producto vertical**: "Empezar con datos de ejemplo" al crear la empresa, con "Borrar datos de ejemplo" después, a partir de la plantilla publicada.
  - **Solo si marketing lo pide**: demo propia por visitante, en una empresa temporal copiada de la plantilla, que caduca y se borra, con protección contra abusos (Turnstile).
  - **Descartado**: una empresa demo compartida (en solo lectura enseña poco; con escritura, cada visitante cambia lo que ve el siguiente y queda expuesta al spam).
- **Siguiente paso**: lo decide con ADR el primer PRD que lo necesite (probablemente la página pública).

---

## Reutilizable del proyecto anterior (`C:\Dev\SaaS\reference\wecampo\`)

Revisado el 13 nov 2026. Solo como referencia: se reescribe dentro del ciclo de D20, nunca se copia tal cual. Rutas relativas a `wecampo-monorepo-master/`.

| Qué | Dónde | Cuándo y cómo |
|---|---|---|
| `tsconfig` base | `tsconfig.base.json` | Ticket 1: punto de partida, endurecido según D17 y sin `declaration` |
| Grafo de tareas de Turborepo | `turbo.json` | Ticket 1: con los nombres de D16 y sin `^build` (D18) |
| Esqueleto del workflow de CI | `.github/workflows/ci.yml` | Ticket 2: pnpm fijado, caché, `--frozen-lockfile`, `concurrency`; pasos sustituidos por `pnpm check` |
| Tests de la API con entorno inyectado y casos negativos del webhook | `apps/api/src/app.test.ts` | Ticket 1 y PRD de billing: como `*.int.test.ts` en workerd (D29) |
| Registro de webhooks y su test | `apps/api/src/routes/webhooks/workos/strategies/` | PRD "Plans and billing": registro de Stripe según D53 |
| Factorías `make<Entidad>(overrides)` | `packages/core/.../application/user/user.test.ts` | Primeras tablas: con IDs UUIDv7 fijos y fechas fijas (D29, D44) |
| Listado paginado con Drizzle | `packages/core/.../drizzle-user-repository.ts`, `domain/queries.ts` | Primera lista (Members): con `tenant_id` y búsqueda escapada, al decidir la paginación (D53) |
| Componentes de interfaz compuestos | `packages/ui/src/components/` | Al montar la SPA: sin Next ni next-themes, con `tokens.css`, i18n y accesibilidad (`docs/design/`) |
| Auditoría de UI como checklist de accesibilidad | `docs/superpowers/specs/2026-05-05-ui-ux-audit-fixes-design.md` | Al adaptar los componentes; lo principal ya está en `docs/design/patterns.md` |
| Cliente y claves de TanStack Query | `apps/bo/src/lib/query-client.ts`, `hooks/use-users.ts` | Al decidir el estado del servidor en el frontend (D53) |

No se reutilizan: Next.js con OpenNext, server actions como API, sesión de AuthKit, CORS entre orígenes, WorkOS como fuente de verdad, buses de comandos e inyección hecha a mano, tests sobre falsos en memoria, migraciones con scripts manuales, herramientas de openspec y `.claude/settings.local.json` (rutas personales; nunca al repo, D43).

---

## Coste y riesgos

- **Cero gastos en las etapas preliminares** (decidido el 12 nov 2026): todo con planes gratuitos hasta que haya clientes reales. Sin dominio propio (URLs `*.workers.dev`, D11 y D14), CodeRabbit gratuito (D41), Workers/D1/KV Free, GitHub Free con repo público (D43), Stripe en test mode (D51). Cualquier gasto es una decisión explícita con su motivo.

- **Workers Free**: 100.000 peticiones/día y 10 ms de CPU por petición. Suficiente para desarrollo y beta; producción con tráfico real probablemente exija Workers Paid (5 $/mes). Se decidirá con datos.
- **D1 Free**: 500 MB por base, 100k filas escritas/día. **KV Free**: 1.000 escrituras/día.
- **Rate limiting** (§32): binding GA, sin confirmar en Free; aplazado.
- **Queues**: ⚠ verificar si entra en el plan gratuito antes de usarla (D56).

## Fallos conocidos de las piezas aplazadas

Se recogerán en sus ADRs para no reabrirlos.

- **Sync offline (§5)**: dos dispositivos que editan la misma fila pierden datos en silencio. Necesita versión asignada por servidor y gestión de conflictos; encolar el push (§13) impide devolver el conflicto.
- **Postgres (§8)**: dos esquemas Drizzle con tipos no unificados.
- **Sandbox `is_test_mode` (§33)**: mismo riesgo de fuga que `tenant_id`.
- **Búsqueda vectorial (§7)**: comparar Tinybird con Vectorize.

## Verificación (9 y 10 nov 2026, documentación oficial)

- **Confirmado**: workers.dev sin wildcard · Pages sin wildcard · rutas wildcard + apex · Universal SSL de un nivel · Static Assets · D1 (límites, solo `batch()`, Time Travel 7/30 días) · read replicas en beta · KV (límites, propagación ≥ 60 s) · Workers Free (100k peticiones, 10 ms CPU) · rollback a 100 versiones · workers.dev en la PSL · `@cloudflare/vitest-plugin` · Workers Builds · WorkOS (UI propia, 1M MAU gratis) · sub-issues de GitHub (8 niveles, 100 por padre).
- **Confirmado (10 nov 2026, GitHub)**: protección de rama, rulesets, secretos por Environment y required reviewers solo en repos públicos con el plan gratuito · nadie puede aprobar su propia PR · dependencias "blocked by" disponibles en Free · Projects en Free.
- **Sin confirmar**: rate limiting en Free · precio de ACM · issue types en cuentas personales (se usan etiquetas) · listas de bypass de rulesets en repos personales · PostHog cookieless y su plan gratuito.

## Arranque: nombre y cuentas (antes de "Working foundation")

Pasos 🧑 de la persona, en este orden; cada cuenta se crea con el email del paso 2, con 2FA y la contraseña en un gestor:

1. **Nombre**: **workampo** (estilo de marca "worKampo"), por si el producto sigue esa línea aunque hoy sea un SaaS genérico. Comprobado el 12 nov 2026: libre en GitHub, `workampo.com` libre en Cloudflare Registrar, nada en Google y sin marcas registradas encontradas. ✅ Fijado: email, GitHub y subdominio de workers.dev conseguidos (pasos 2, 3 y 5). El dominio no se compra en esta etapa (ver "Coste y riesgos"); `workampo.com` aparece en los ejemplos como dominio futuro. Sustituye al provisional `tusaas` en todo el diseño; el repo se llama `workampo` (D43).
2. **Cuenta de Gmail** del proyecto (✅ creada el 12 nov 2026; la dirección irá a `worKampo/business` cuando lo cree el ticket 2, nunca al repo público, D43): dueña de todas las cuentas siguientes y destino de avisos (GitHub, Cloudflare, Sentry, monitor). Separada de cualquier cuenta personal o de trabajo. 2FA con app o passkey, códigos de recuperación en el gestor de contraseñas y email personal como recuperación. **Sigue siendo la dueña de las cuentas también cuando haya dominio** (14 nov 2026): una cuenta con un email del propio dominio quedaría inaccesible si el DNS o el reenvío fallan, y Cloudflare, que gestionará el dominio, es justo la que lo arregla. Las direcciones del dominio son solo para hablar con otros (D14).
3. **GitHub** (decidido el 12 nov 2026: **usuario + organización**; ✅ creados el 13 nov 2026): usuario **`workampo-dev`** con el Gmail del proyecto, 2FA y email privado (*noreply*), y organización **`worKampo`** (GitHub no distingue mayúsculas: `github.com/workampo`) en el plan Free, con 2FA obligatorio, dueña del repo público (D43). La organización encaja mejor con la GitHub App de los agentes (D41), los rulesets y futuros colaboradores. El repo se crea en el ticket 1 de "Working foundation".
   - **Todo lo que sube a GitHub va con la cuenta del proyecto, con ninguna otra**. La máquina puede tener git, `gh` y Claude Code configurados globalmente para otros proyectos, así que la separación es por carpeta (✅ configurado y comprobado el 15 nov 2026):
     - **Identidad de git por carpeta**: un `includeIf "gitdir/i:<carpeta del proyecto>/"` en el `.gitconfig` global carga un `.gitconfig` del proyecto con `user.name` y el email *noreply* de la cuenta del proyecto (`<id>+<usuario>@users.noreply.github.com`; el repo es público y no debe exponer emails, D43).
     - **Hooks**: el `.gitconfig` del proyecto anula cualquier `core.hooksPath` global, y `pnpm install` lo fija también en el propio repo, para que solo corran los hooks del repo (lefthook, D17).
     - **Credenciales**: clave SSH propia del proyecto con un alias de host en `~/.ssh/config` (`github-workampo`) y el remoto del repo usando ese alias; `gh` con la cuenta del proyecto en una configuración aparte (`GH_CONFIG_DIR`) y una función de shell que la usa solo dentro de la carpeta del proyecto. No se usa `gh auth switch` (la cuenta activa es global) ni `gh auth setup-git` (ayudante de credenciales global).
     - **Hooks globales de Claude Code**: los que un proyecto no puede desactivar se saltan este repo mediante una opción del `.gitconfig` del proyecto. ✅ Comprobado el 16 nov 2026 con el primer commit del agente (PR #1).
     - **Salvaguardas**: `pnpm work` comprueba que `gh` y el autor de git son la cuenta del proyecto (definida en `project.yaml`, D45) y se niega si no; CI rechaza PRs con commits cuyo email no sea el *noreply* del proyecto.
     - **Agentes**: el `CLAUDE.md`/`AGENTS.md` del repo deja claro que las reglas globales de la máquina no aplican aquí (las issues son de GitHub y la trazabilidad es la de D42).
4. **CodeRabbit**: instalar su app de GitHub en el repo (plan gratuito, D41). Ticket 2.
5. **Cloudflare** (✅ cuenta creada el 13 nov 2026, plan Free, 2FA, subdominio **`workampo.workers.dev`**): los recursos (Workers, D1, KV) los crea el script de aprovisionamiento del ticket 3, que ejecuta la persona; nada a mano en el panel salvo los tokens de API por entorno (D13), que crea la persona (🧑). El Account ID irá en `project.yaml` (D45).
6. **El resto, cuando lo pida su PRD**: Sentry (organización en la región UE, D63) y el monitor de disponibilidad en el ticket 3 de "Working foundation"; WorkOS y Brevo en "Access and first company"; Stripe (test mode) en "Plans and billing". Todas con el mismo email.
7. **Gestor de contraseñas** (D64), antes del ticket 1: cuenta personal de Bitwarden con el email personal (no el del proyecto), contraseña maestra solo memorizada, 2FA y código de recuperación impreso fuera del ordenador. Carpeta "worKampo" con las contraseñas y códigos de recuperación de las cuentas ya creadas (Gmail, GitHub, Cloudflare). ✅ Creado el 14 nov 2026 en la región UE (`vault.bitwarden.eu`, coherente con D63); la app y la extensión deben apuntar a `bitwarden.eu` o no encuentran la cuenta.

## Pendiente al crear el repo

- Código de la versión anterior (monorepo Next.js de weCampo): en `C:\Dev\SaaS\wecampo-monorepo-master.zip`, fuera del repo. Es solo referencia para consultar cómo se resolvió algo de arquitectura o una funcionalidad concreta, cuando haga falta; no se revisa entero. Si se extrae, a `C:\Dev\SaaS\reference\wecampo\` (fuera del repo) y nunca se copia código sin pasar por el ciclo de D20.
- Ejecutar el PRD "Working foundation".
- Renombrar `docs/diseno.html` a `docs/design-overview.html` (política de idioma) cuando deje de usarse la URL actual.
