PRD #10 · Ticket #96 · Branch: feature/96-entrar-con-codigo-o-google-y-salir

Decisiones de base: [ADR-0073](../docs/adr/0073-frontend-stack-and-rate-limiting.md) (pila web, servir la SPA, límites en D1), [ADR-0071](../docs/adr/0071-identity-providers.md) (interfaz de identidad, enlace), [ADR-0008](../docs/adr/0008-own-session-in-d1-host-only-cookie.md) (sesión propia), [ADR-0044](../docs/adr/0044-migrations-reference-data-seeds-and-backfills.md), [ADR-0047](../docs/adr/0047-i18n-from-the-start.md), [ADR-0053](../docs/adr/0053-code-conventions.md), [ADR-0029](../docs/adr/0029-testing-strategy.md), [ADR-0030](../docs/adr/0030-test-designer.md). Las decisiones que ningún ADR cubre van marcadas **[decisión]**.

## Architecture of the slice

```
navegador ── /login, /login/code, /  (Static Assets: apps/web/dist, _headers con CSP)
   │  fetch same-origin (hc + TanStack Query), cookie __Host-session
   ▼
Worker app (apps/api) ── /api/* /health /l/* (run_worker_first)
   ├─ access/            rutas y casos de uso de entrada (código, Google, me, salir), repos de users e identities
   ├─ _shared/auth/      interfaz de identidad, WorkOS (fetch), fake, chooseProvider, sesión (cookie + repo + middleware)
   ├─ _shared/rate-limit/ contadores de ventana fija
   ├─ _shared/db/        cliente Drizzle de DB_GLOBAL
   └─ scheduled()        borra contadores caducados
   ▼
DB_GLOBAL: users, identities, sessions, rate_limit_counters        WorkOS API (magic_auth, authenticate, authorize URL)
```

Carpetas y ficheros nuevos (los de cada task, en `.work/tasks.md`):

| Ruta                                                                                                        | Qué                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/db/schema/global.ts`, `packages/db/drizzle.config.ts`, `packages/db/migrations/global/000N_*.sql` | Esquema Drizzle y migraciones generadas                                                                                                                                                             |
| `scripts/db/migration-new.mjs`                                                                              | `pnpm db:migration:new --global\|--shard [--data] <verb_object>`: `drizzle-kit generate`, renombra a `000N_<verb_object>.sql`, añade `-- ticket: #N` (de la rama)                                   |
| `packages/db/seed/global/*.sql`                                                                             | Usuarios, identidades y sesión caducada del proveedor falso                                                                                                                                         |
| `packages/domain/access/`                                                                                   | Esquemas Zod de entrada (`emailSchema`, `startCodeSignInSchema`, `verifyCodeSchema`) y `ACCESS_ERROR_CODES`                                                                                         |
| `apps/api/src/_shared/env.ts`                                                                               | Zod de variables y secretos, validado al arrancar                                                                                                                                                   |
| `apps/api/src/_shared/ids/uuid.ts`                                                                          | UUIDv7 sobre `crypto`                                                                                                                                                                               |
| `apps/api/src/_shared/http/problem-json.ts`                                                                 | Errores de dominio → `application/problem+json` con `code`                                                                                                                                          |
| `apps/api/src/_shared/db/global-db.ts`                                                                      | `drizzle(env.DB_GLOBAL, { casing: 'snake_case' })`                                                                                                                                                  |
| `apps/api/src/_shared/auth/`                                                                                | `identity-provider.ts`, `workos-provider.ts`, `fake-provider.ts`, `fake-identities.ts`, `choose-provider.ts`, `identity-provider.contract.ts`, `session.ts`, `session-repo.ts`, `session-cookie.ts` |
| `apps/api/src/_shared/rate-limit/`                                                                          | `rate-limit.ts`, `rate-limit-repo.ts`, `delete-expired-counters.ts`                                                                                                                                 |
| `apps/api/src/access/`                                                                                      | `routes.ts`, `start-code-sign-in.ts`, `complete-sign-in.ts`, `start-google-sign-in.ts`, `complete-google-sign-in.ts`, `sign-out.ts`, `user-repo.ts`, `identity-repo.ts`, `errors.ts`, tests         |
| `apps/api/test/setup.ts`                                                                                    | Aplica migraciones D1 en Vitest (`applyD1Migrations`)                                                                                                                                               |
| `apps/api/e2e/acceptance/`                                                                                  | Un Playwright por ejemplo (E1–E18)                                                                                                                                                                  |
| `packages/ui/`                                                                                              | Tokens, IBM Plex Sans propia, Tailwind v4, `Button`, `Input`, `Field`, `Card`                                                                                                                       |
| `apps/web/`                                                                                                 | Vite + React, router, query, i18n, pantallas de `access`, `public/_headers`                                                                                                                         |
| `scripts/i18n/check-keys.mjs`                                                                               | Falla si `en.json` y `es.json` no tienen las mismas claves (en `check:repo`)                                                                                                                        |
| `scripts/build/no-fake-provider.mjs`                                                                        | Falla si el bundle de stg/prod contiene el proveedor falso                                                                                                                                          |

## Data model

Todo en `DB_GLOBAL` (`schema/global.ts`), sin `tenant_id`: no son tablas de empresa ([code conventions](../docs/process/code-conventions.md#tables)). Drizzle con `casing: 'snake_case'`; instantes en texto ISO UTC.

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY NOT NULL,              -- UUIDv7 de la app
  email TEXT NOT NULL,                       -- siempre en minúsculas, verificado
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX uq_users__email ON users (email);

CREATE TABLE identities (
  provider TEXT NOT NULL CHECK (provider IN ('workos')),
  subject TEXT NOT NULL,                     -- id del usuario en el proveedor
  user_id TEXT NOT NULL REFERENCES users (id),
  created_at TEXT NOT NULL,
  PRIMARY KEY (provider, subject)
);
CREATE INDEX idx_identities__user_id ON identities (user_id);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY NOT NULL,              -- UUIDv7
  user_id TEXT NOT NULL REFERENCES users (id),
  token_hash TEXT NOT NULL,                  -- SHA-256 hex del token de la cookie
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,                  -- created_at + 30 días, fijo
  revoked_at TEXT                            -- null = activa
);
CREATE UNIQUE INDEX uq_sessions__token_hash ON sessions (token_hash);
CREATE INDEX idx_sessions__user_id ON sessions (user_id);

CREATE TABLE rate_limit_counters (
  key TEXT NOT NULL,                         -- '<purpose>:<subject kind>:<sha256 hex>'
  window_started_at TEXT NOT NULL,
  count INTEGER NOT NULL,
  expires_at TEXT NOT NULL,                  -- fin de la ventana; lo usa el cron
  PRIMARY KEY (key, window_started_at)
);
CREATE INDEX idx_rate_limit_counters__expires_at ON rate_limit_counters (expires_at);
```

- **[decisión]** La cookie lleva un token aleatorio de 32 bytes (base64url); la tabla guarda solo su SHA-256 (`token_hash`), así una copia de la base de datos no da sesiones. `id` UUIDv7 aparte, para poder listar o revocar una sesión concreta más adelante.
- **[decisión]** `rate_limit_counters` no lleva `created_at`: `window_started_at` es su instante de creación. Los sujetos (email, IP) se guardan como SHA-256 sin sal, como dice ADR-0073; las filas viven una ventana.
- Propósitos de contador: `code_request:email`, `code_request:ip`, `code_attempt:email`.
- Las cuatro tablas en migraciones separadas (una por cambio), en este orden: `0000_create_users`, `0001_create_identities`, `0002_create_sessions`, `0003_create_rate_limit_counters`. Todas `-- ticket: #96`.

## Migrations

- Solo Expand: cuatro tablas nuevas, nada se borra ni se renombra. Ningún paso irreversible.
- Generadas con `pnpm db:migration:new --global <verb_object>` (nace en este ticket, ADR-0044); el SQL sale del esquema, no se escribe a mano.
- Staging las aplica el deploy automático; producción, la release.

## API contracts

Todas bajo `/api`, mismo origen, JSON. Errores `application/problem+json` con `code` estable (`access.<reason>`) que la web traduce. Validación con `@hono/zod-validator` y los esquemas de `packages/domain/access/`. `csrf()` de Hono en `/api/*` (comprueba `Origin` en peticiones con cuerpo de formulario); el resto exige `Content-Type: application/json`, que obliga a preflight entre orígenes.

| Ruta                                | Entrada                               | Éxito                                              | Errores                                                                                                                                          | Ejemplos      |
| ----------------------------------- | ------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| `POST /api/sign-in-codes`           | `{ email }`                           | `202` sin cuerpo                                   | `400 access.invalid_email`, `429 access.too_many_code_requests`                                                                                  | E1, E5        |
| `POST /api/sessions`                | `{ email, code }` (código: 6 dígitos) | `201 { user: { id, email } }` + `Set-Cookie`       | `400 access.invalid_code` (incorrecto o caducado), `429 access.too_many_attempts`, `403 access.email_not_verified`, `409 access.contact_support` | E2–E4, E8–E13 |
| `GET /api/sessions/google`          | —                                     | `302` a la URL de autorización + cookie de `state` | —                                                                                                                                                | E6            |
| `GET /api/sessions/google/callback` | `?code&state` o `?error&state`        | `302 /` + `Set-Cookie`                             | `302 /login?error=<code>`: `access.invalid_state`, `access.google_failed`, `access.email_not_verified`, `access.contact_support`                 | E6–E12        |
| `GET /api/me`                       | cookie                                | `200 { id, email }`                                | `401 access.unauthenticated`                                                                                                                     | E2, E14, E15  |
| `DELETE /api/sessions/current`      | cookie                                | `204` + cookie borrada                             | `401 access.unauthenticated`                                                                                                                     | E14           |

- `POST /api/sign-in-codes` responde igual exista o no la cuenta (no permite enumerar cuentas). El idioma del email sale de `Accept-Language` (`es*` → `es`, si no `en`) y se pasa a WorkOS como `locale`.
- `POST /api/sessions` y el callback llaman a un único caso de uso `completeSignIn(identity, previousSessionToken)` con las reglas de enlace:
  1. Email no verificado → `access.email_not_verified` (E9).
  2. `(provider, subject)` conocido → su usuario. Si el email verificado cambió: si pertenece a otro usuario → `access.contact_support` y nada cambia (E12); si no, se guarda (E11).
  3. Desconocido y el email ya es de un usuario → `access.contact_support`, no se crea ni se enlaza nada (E10).
  4. Desconocido y email libre → crea `users` + `identities` en un solo `batch()` (E2).
  5. Revoca la sesión de la cookie que traía la petición, si la había, y crea una nueva, en el mismo `batch()` (E13).
- **[decisión]** El callback de Google, en error, redirige a `/login?error=<code>` (solo el código de error, nada personal en la URL); la web muestra el mensaje.
- `chooseProvider` devuelve siempre `workos` (ADR-0071, MVP).

## Session cookie

| Cookie               | Valor                         | Atributos                                                                         |
| -------------------- | ----------------------------- | --------------------------------------------------------------------------------- |
| `__Host-session`     | token de 32 bytes base64url   | `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000` (30 días); sin `Domain` |
| `__Host-oauth_state` | `state` aleatorio de 32 bytes | `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`; se borra en el callback    |

- Middleware `session` en `_shared/auth/session.ts`: lee la cookie, busca por `token_hash`, rechaza si `revoked_at` no es null o `expires_at <= now` (E15). 30 días fijos, sin renovación (la caducidad por inactividad es Post-MVP).
- Una sesión nueva en cada entrada; la anterior del navegador se revoca (E13). Salir pone `revoked_at` y borra la cookie (E14).
- Comparación del `state` en tiempo constante (`crypto.subtle.timingSafeEqual`).

## WorkOS adapter and fake

Interfaz en `_shared/auth/identity-provider.ts`:

```ts
type VerifiedIdentity = {
  provider: 'workos'
  subject: string
  email: string
  isEmailVerified: boolean
}
type IdentityProvider = {
  startCodeSignIn(input: {
    email: string
    locale: 'en' | 'es'
    ipAddress?: string
    userAgent?: string
  }): Promise<void>
  completeCodeSignIn(input: {
    email: string
    code: string
    ipAddress?: string
    userAgent?: string
  }): Promise<VerifiedIdentity>
  googleAuthorizationUrl(input: { state: string; redirectUri: string }): string
  completeGoogleSignIn(input: {
    code: string
    ipAddress?: string
    userAgent?: string
  }): Promise<VerifiedIdentity>
}
```

Errores propios: `InvalidCodeError`, `ProviderUnavailableError`. El nombre de la persona no se guarda (ADR-0071).

- **WorkOS** (`workos-provider.ts`), con `fetch` inyectable (los tests pasan un `fetch` de prueba; nunca `vi.mock`):
  - `POST https://api.workos.com/user_management/magic_auth` `{ email, locale }` con `Authorization: Bearer WORKOS_API_KEY`. **La respuesta trae el código: el adaptador no lo lee ni lo devuelve.**
  - `POST /user_management/authenticate` con `client_id`, `client_secret` (la API key), `grant_type` `urn:workos:oauth:grant-type:magic-auth:code` + `code` + `email`, o `authorization_code` + `code`; siempre `ip_address` (`CF-Connecting-IP`) y `user_agent`. Se queda con `user.id`, `user.email`, `user.email_verified`; descarta `access_token`, `refresh_token` y `oauth_tokens`. `400`/`invalid_grant` → `InvalidCodeError`.
  - URL `https://api.workos.com/user_management/authorize?response_type=code&client_id=…&redirect_uri=…&provider=GoogleOAuth&state=…`.
- **Fake** (`fake-provider.ts` + `fake-identities.ts`), solo local y tests. Contrato fijo que usan los tests y el seed:

| Email escrito                 | Identidad devuelta                         | Seed                                                         | Ejemplo        |
| ----------------------------- | ------------------------------------------ | ------------------------------------------------------------ | -------------- |
| cualquier otro                | `fake\|<email>`, mismo email, verificado   | —                                                            | E1, E2, E4, E5 |
| `linked@example.com`          | `fake\|linked`, `linked@example.com`       | usuario enlazado a `fake\|linked`                            | E8             |
| `unverified@example.com`      | `fake\|unverified`, no verificado          | —                                                            | E9             |
| `taken@example.com`           | `fake\|taken@example.com`                  | usuario `taken@example.com` enlazado a `fake\|taken-old`     | E10            |
| `renamed@example.com`         | `fake\|renamed`, `renamed.new@example.com` | usuario `renamed.old@example.com` enlazado a `fake\|renamed` | E11            |
| `clash@example.com`           | `fake\|clash`, `linked@example.com`        | usuario `clash@example.com` enlazado a `fake\|clash`         | E12            |
| Google (código `fake-google`) | `fake\|google`, `google@example.com`       | usuario enlazado a `fake\|google`                            | E6, E8         |

- Código válido: `424242`; `000000` simula caducado; cualquier otro, incorrecto. Ambos → `InvalidCodeError`.
- `googleAuthorizationUrl` del fake apunta a nuestro propio callback: `<redirectUri>?code=fake-google&state=<state>`.
- Sesión caducada del seed (E15): token `seed-expired-session`, creada `2026-01-01T00:00:00.000Z`, caduca `2026-01-31T00:00:00.000Z`, del usuario `linked@example.com`. Caducada, no sirve como puerta trasera.
- Proveedor `workos` en `identities` también para el fake: lo imita.
- **[decisión]** Selección del fake: `IDENTITY_PROVIDER=fake` solo en las `vars` de nivel superior (local) de `wrangler.jsonc`; stg y prod no lo tienen. Además una constante de compilación (`define: { __ALLOW_FAKE_IDENTITY__: "true" }` solo en local, `"false"` en `env.stg` y `env.prod`) deja el fake fuera del bundle, y `scripts/build/no-fake-provider.mjs` hace fallar el build de stg/prod si aparece su marca (ADR-0029: "the production build fails if it includes it").
- Suite de contrato `identity-provider.contract.ts`: la misma batería contra WorkOS (con `fetch` de prueba) y contra el fake: código válido → identidad; inválido → `InvalidCodeError`; `startCodeSignIn` no devuelve nada; la URL de Google lleva `state`.
- dependency-cruiser: `workos-provider` y `fake-provider` solo se importan desde `_shared/auth/`.

## Rate limiting

Ventana fija (ADR-0073). `hit(purpose, subject)` hace `INSERT … ON CONFLICT (key, window_started_at) DO UPDATE SET count = count + 1 RETURNING count` y compara con el umbral.

| Propósito      | Sujeto                  | Cuándo                       | Variable del umbral                  |
| -------------- | ----------------------- | ---------------------------- | ------------------------------------ |
| `code_request` | email                   | antes de pedir a WorkOS      | `RATE_LIMIT_CODE_REQUESTS_PER_EMAIL` |
| `code_request` | IP (`CF-Connecting-IP`) | antes de pedir a WorkOS      | `RATE_LIMIT_CODE_REQUESTS_PER_IP`    |
| `code_attempt` | email                   | antes de comprobar el código | `RATE_LIMIT_CODE_ATTEMPTS_PER_EMAIL` |

- Ventana común `RATE_LIMIT_WINDOW_SECONDS`.
- **[decisión]** `code_attempt` cuenta cada intento antes de llamar a WorkOS, no solo los fallidos: es atómico, no tiene carreras y no pregunta a WorkOS cuando ya se pasó. Un intento con éxito acaba el flujo, y pedir un código nuevo ya está limitado, así que el efecto para la persona es el de E4. Si el spec reviewer lo ve distinto de "intentos fallidos", es parada 1.
- Umbrales locales (valores de prueba) en `vars` de nivel superior; en stg y prod son secretos de Cloudflare (no entran en el repo, AGENTS.md "No entra").
- El cron del Worker (`scheduled`, una vez al día) borra `rate_limit_counters` con `expires_at < now`.

## SPA build and serving

- `apps/web`: Vite 8 + React 19, `@vitejs/plugin-react`, `@tailwindcss/vite`; TanStack Router con rutas en código (`/login`, `/login/code`, `/`), TanStack Query sobre `hc<AppType>` con cabecera `X-Client-Version: import.meta.env.VITE_APP_VERSION`; react-hook-form + resolver Zod; i18next + react-i18next.
- Rutas de la web dentro del dominio: `apps/web/src/access/` (pantallas, hooks, `routes.ts`); `apps/web/src/_shared/` (router raíz, cliente API, i18n).
- `/` exige sesión (`beforeLoad` con `GET /api/me`; `401` → `/login`). Con sesión, estado vacío "Aún no perteneces a ninguna empresa" con "Cerrar sesión".
- **[decisión]** El email de la pantalla de código viaja en el estado del router (memoria), nunca en la URL; si se recarga `/login/code` sin estado, vuelve a `/login`.
- Botón de Google: un `<a href="/api/sessions/google">` (navegación completa).
- `apps/api/wrangler.jsonc` gana, en el nivel superior **y repetido en `env.stg` y `env.prod`** (no está confirmado que se herede, ADR-0073): `assets: { directory: "../web/dist", binding: "ASSETS", not_found_handling: "single-page-application", run_worker_first: ["/api/*", "/health", "/l/*"] }`. La task lo comprueba con `wrangler deploy --dry-run --env stg`.
- `apps/web/public/_headers`: `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`; `/assets/*` `immutable`; `/index.html` `no-cache` (ADR-0059).
- `@workampo/web` es devDependency de `@workampo/api`; en `turbo.json`, `build`, `e2e` y `test` de api dependen de `^build`. `pnpm work verify` construye la web antes de `wrangler dev`.
- Desarrollo: `vite` con `server.proxy` de `/api` a `wrangler dev` en 8787.
- **[decisión]** Las pruebas de aceptación viven en `apps/api/e2e/acceptance/`: el Worker `app` sirve SPA y API, y allí está el único Playwright con su `webServer` (ADR-0029 "a single Playwright"). `baseURL` pasa a `http://localhost:8788` para que el navegador acepte cookies `Secure` sobre http local.

## i18n

- `apps/web/src/_shared/i18n/`: `i18n.ts`, `en.json`, `es.json`, `i18next.d.ts` (claves tipadas). Claves `access.login.*`, `access.code.*`, `access.home.*`, `access.errors.<reason>`.
- Idioma: sin preferencia de usuario ni empresa todavía, `navigator.languages` (lo mismo que `Accept-Language`) → `es` si el primero que encaja es `es*`, si no `en` (ADR-0047). Sin plugin de detección. `<html lang>` al idioma activo.
- `scripts/i18n/check-keys.mjs` en `check:repo`: falla si falta una clave en algún idioma.
- `packages/ui`: tokens de `docs/design/tokens.css`, IBM Plex Sans desde `@fontsource/ibm-plex-sans` copiada al build (mismo origen), componentes `Button`, `Input`, `Field`, `Card`, `Logo` adaptados de shadcn.

## Tests per example

Cada test cita su `@id` (`access-96-N` = EN). Primera wave en `it.fails`; las de integración solo hablan HTTP con `exports.default.fetch` y SQL de preparación, para que compilen sin código nuevo. El fake fija los datos (tabla de arriba); los tests que crean cuentas o gastan límites usan emails aleatorios `new-<uuid>@example.com`, porque la base de E2E persiste entre ejecuciones.

| Ej. | Integración (`apps/api/src/access/*.int.test.ts`)                                                                           | Unidad (en su task)                                          | Aceptación (`apps/api/e2e/acceptance/`)                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| E1  | `202`, cuerpo sin `424242`                                                                                                  | WorkOS: `magic_auth` con email y `locale`, el código no sale | `/login` → pantalla de código con el email                                   |
| E2  | `201`, usuario creado, `GET /api/me` = email                                                                                | `completeSignIn` crea usuario + identidad                    | entra y ve el estado vacío                                                   |
| E3  | `400 access.invalid_code` con `000000` y `111111`, sin cookie                                                               | WorkOS: `invalid_grant` → `InvalidCodeError`                 | mensaje y "Reenviar código"                                                  |
| E4  | intentos hasta `429 access.too_many_attempts`; luego `424242` también `429`                                                 | `hit` al límite                                              | mensaje de esperar                                                           |
| E5  | peticiones hasta `429 access.too_many_code_requests`                                                                        | ventana y límite por IP                                      | mensaje de esperar                                                           |
| E6  | `/google` → `302` con cookie de `state`; callback con ese `state` → `302 /` + sesión                                        | URL de autorización de WorkOS                                | "Continuar con Google" → estado vacío                                        |
| E7  | callback con `state` distinto o sin cookie → `302 /login?error=access.invalid_state`, sin `Set-Cookie` de sesión            | comparación en tiempo constante                              | `state` alterado → sin sesión                                                |
| E8  | `linked@example.com` dos veces → mismo `id`, una fila de usuario                                                            | regla 2                                                      | entra con código y con Google en la misma cuenta                             |
| E9  | `unverified@example.com` → `403 access.email_not_verified`                                                                  | regla 1                                                      | mensaje "entra con un email verificado"                                      |
| E10 | `taken@example.com` → `409 access.contact_support`, sin filas nuevas                                                        | regla 3                                                      | mensaje de soporte                                                           |
| E11 | `renamed@example.com` → `GET /api/me` = `renamed.new@example.com`                                                           | regla 2                                                      | email nuevo tras entrar                                                      |
| E12 | `clash@example.com` → `409`, ningún usuario cambia                                                                          | regla 2                                                      | mensaje de soporte                                                           |
| E13 | `Set-Cookie` con `__Host-session`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, sin `Domain`; el token anterior da `401` | `session-cookie`                                             | atributos de la cookie y la sesión anterior                                  |
| E14 | `DELETE /api/sessions/current` → `204`; el token da `401`                                                                   | —                                                            | "Cerrar sesión" → `/` lleva a `/login`                                       |
| E15 | token del seed caducado → `401`; sesión de hace 30 días + 1 s → `401`                                                       | `expires_at` = creación + 30 días                            | cookie caducada del seed → `/login`                                          |
| E16 | `_headers` con la CSP (test de la web)                                                                                      | —                                                            | ninguna petición a otro origen; sin campo de contraseña ni textos prohibidos |
| E17 | —                                                                                                                           | `resolveLanguage` (unidad de la web)                         | locale `es-ES` → textos en español                                           |
| E18 | —                                                                                                                           | —                                                            | mismo escenario que el smoke: código del fake en local, de WorkOS en staging |

Casos límite fijos (ADR-0029): email con mayúsculas y espacios se normaliza; email de 254 caracteres y unicode en la parte local; código con letras o de 5/7 dígitos → `400` sin llamar al proveedor; dos `hit` concurrentes cuentan 2; dos altas simultáneas del mismo email crean un único usuario (índice único). El aislamiento entre empresas no aplica: ninguna ruta de este ticket tiene empresa.

E18 en staging: el mismo `sign-in.e2e.ts` con `@smoke` corre contra `https://app-stg.workampo.workers.dev` cuando `E2E_BASE_URL` está definido (sin `webServer`); el código lo crea `POST /user_management/magic_auth` con `WORKOS_API_KEY` del Environment `stg` y lee `code` de la respuesta. El usuario de smoke es `smoke@example.com`.

## Flags

Ninguno: la entrada es la puerta de la app, no hay estado previo que proteger.

## Analytics events

Ninguno en este ticket: no hay proveedor de analítica todavía y `/login` no carga scripts de terceros.

## Security

Zona crítica (sesión, `_shared/auth/`, migraciones, `wrangler.jsonc`): `size:L`, security reviewer a nivel `max`.

- **CSRF y `state`**: `state` de 32 bytes en cookie `__Host-` de 10 minutos, comparado en tiempo constante y borrado al usarse (E7). API con `SameSite=Lax`, JSON obligatorio y `csrf()` de Hono. Salir es `DELETE`, nunca `GET`.
- **Cookie**: `__Host-`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, sin `Domain` (E13). Token nuevo en cada entrada (sin fijación de sesión); solo su hash en D1.
- **Límites**: tabla de arriba; umbrales fuera del repo en stg y prod. Los límites de WorkOS quedan como segunda capa.
- **El código no sale de la API**: el adaptador ignora `code` de `magic_auth`; test de contrato y E1 lo comprueban.
- **Logs y errores**: ningún log con email, código, token, `state` ni IP. Sentry ya tiene `urlQueryParams`, `httpBodies`, `cookies` y `httpHeaders` desactivados; un test comprueba que el callback de Google (`?code=…&state=…`) no llega a Sentry con su query.
- **Enumeración de cuentas**: pedir código responde igual exista o no la cuenta. Los mensajes de E10 y E12 solo aparecen tras probar un código válido o Google, es decir, tras demostrar que se controla ese email.
- **Secretos**: `WORKOS_API_KEY` solo como secreto (Cloudflare y GitHub Environment `stg`); nunca en logs ni en respuestas.
- **Proveedor falso**: imposible en stg y prod (variable + constante de compilación + check del bundle).
- **CSP estricta** en la SPA; sin scripts, fuentes ni imágenes de otro origen (E16).
- Lo que se manda a WorkOS: email, `locale`, IP y user agent (ADR-0071, ADR-0073).

## 🧑 Manual steps

Nombres de secretos y variables, nunca valores.

1. **WorkOS, entorno de staging**: crear la cuenta (si no existe), activar Magic Auth y Google OAuth (credenciales por defecto de WorkOS en staging), registrar la Redirect URI `https://app-stg.workampo.workers.dev/api/sessions/google/callback`.
2. **Secretos de `app-stg`** (`wrangler secret put … --env stg`): `WORKOS_API_KEY`, `RATE_LIMIT_CODE_REQUESTS_PER_EMAIL`, `RATE_LIMIT_CODE_REQUESTS_PER_IP`, `RATE_LIMIT_CODE_ATTEMPTS_PER_EMAIL`, `RATE_LIMIT_WINDOW_SECONDS`. `WORKOS_CLIENT_ID` va como `var` en `wrangler.jsonc` (no es secreto): la persona da el valor de staging y el de producción.
3. **GitHub Environment `stg`**: secreto `WORKOS_API_KEY` para el smoke de E18.
4. **`deploy.yml`**: añadir el paso del smoke E18 tras el smoke de `/health` en `stg` (`pnpm --filter @workampo/api exec playwright test --grep @smoke` con `E2E_BASE_URL` y `WORKOS_API_KEY`). El App de los agentes no puede empujar cambios de `.github/workflows/` (learnings): el agente prepara el diff y la persona lo aplica.
5. **Antes de la release a producción** (parada 3, ADR-0065): el entorno de producción de WorkOS pide datos de facturación aunque sea gratis; cliente OAuth de Google propio en Google Cloud con la redirect URI de WorkOS y estado "In production"; Redirect URI `https://app.workampo.workers.dev/api/sessions/google/callback`; los mismos secretos en `app` (`--env prod`). Sin esto la entrada no funciona en producción.
6. Opcional en local: `.dev.vars` con `WORKOS_API_KEY` e `IDENTITY_PROVIDER=workos` para probar WorkOS real; por defecto local usa el fake.

## Risks

| Riesgo                                                                                   | Mitigación                                                                                       |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `assets` no se hereda en `env.*`                                                         | Se repite en cada entorno y se comprueba con `wrangler deploy --dry-run --env stg`               |
| El navegador rechaza cookies `__Host-`/`Secure` sobre `http://127.0.0.1` en E2E y verify | `baseURL` y verify en `localhost` (contexto seguro); si falla, parada antes de relajar atributos |
| Un segundo Magic Auth invalida o no el primero (no documentado)                          | Ningún test depende de ello; el smoke usa el último código que crea                              |
| El fake se cuela en el bundle de producción                                              | Constante de compilación + check del bundle en `build`                                           |
| Escrituras de contadores en D1 Free                                                      | 1–3 filas por entrada, muy por debajo de 100.000/día; cron de limpieza                           |
| `applyD1Migrations` del plugin de Vitest 1.8 cambia de API                               | Comprobado que el plugin lo exporta; si no encaja, setup propio con `env.DB_GLOBAL.batch`        |
| Producción necesita tarjeta en WorkOS                                                    | Paso 🧑 5, decisión explícita antes de la release                                                |
| Google muestra "continuar a workos.com" y sin logo                                       | Aceptado en el MVP (sin dominio propio)                                                          |
| E2E persistente acumula datos                                                            | Emails aleatorios en los tests que crean o limitan; seed idempotente                             |

## Out of scope

- Crear y elegir empresa (tickets 2 y 3), selector de idioma (6), emails con nuestra marca (#66), recuperación de cuenta por código (#68), borrar la identidad en WorkOS (PRD #16), caducidad por inactividad (Post-MVP), Radar de WorkOS, `Authorization: Bearer` para móvil (ADR-0008), PKCE.
- ADR-0059, parte de cliente: aquí solo se envía `X-Client-Version`. La recarga al navegar, el aviso de versión nueva, `X-Min-Client-Version` y que el deploy pase `APP_VERSION` quedan fuera: **pregunta abierta** para el orchestrator (¿otro ticket del PRD #10 o issue nuevo?).
- axe en E2E (ADR-0029): no lo pide ningún ejemplo; propuesta para el UI/UX en Verify.
- Línea de ADR-0071 "las pantallas son nuestras; WorkOS solo verifica": ya está en el ADR (punto 1), no hay que añadirla.
