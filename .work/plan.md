PRD — · Ticket #179 · Branch: feature/179-reorganizar-app-core-y-las-capas-de

Scope: "Done when (approved by the person, 2026-11-25)" of the issue. No behaviour changes: no scenario, endpoint, table or text changes.

## Seams and sharing

- No provider, adapter, domain rule or i18n text changes.
- `packages/app-core` keeps only what the mobile app will use as is: `_api/*.api.ts`, `query-keys.ts`, `queryOptions`, use-case hooks, form schemas, `me.hook.ts` at the domain root.
- Page hooks move as they are, with their tests, beside their page in `apps/web` (no redesign, no router):
  - `access/sign-in/login/login.hook.ts` → `apps/web/src/access/sign-in/login/login.hook.ts`
  - `access/sign-in/code/code.hook.ts` → `apps/web/src/access/sign-in/code/code.hook.ts`
  - `companies/creation/new-company/new-company.hook.ts` (+ `.test.ts`) → `apps/web/src/companies/creation/new-company/`
  - `companies/selection/company-picker/company-picker.hook.ts` (+ `.test.ts`) → `apps/web/src/companies/selection/company-picker/`
  - The 4 web imports (`login.page.tsx`, `code-form.tsx`, `new-company-form.tsx`, `company-picker.page.tsx`) become `./<page>.hook`.
- What the moved hooks import from app-core internals becomes public. `packages/app-core/package.json` `exports`: drop the 4 page-hook entries; add (one named entry per file, no pattern):
  - `./api-error` → `src/_shared/api-error.ts` (`ApiError`, used by `useNewCompanyPage`)
  - `./access/sign-in/start-code` → `start-code.hook.ts`, `./access/sign-in/start-code/form` → `start-code.form.ts`
  - `./access/sign-in/verify-code` → `verify-code.hook.ts`, `./access/sign-in/verify-code/form` → `verify-code.form.ts`
  - `./companies/creation/check-slug` → `check-slug.hook.ts`
  - `./companies/creation/create-company` → `create-company.hook.ts`, `./companies/creation/create-company/form` → `create-company.form.ts`
  - Already exported and used: `./errors`, `./access/me` (`useMe`, `replaceSession`), `./companies/selection/list-my-companies`. `apps/web` already depends on `@workampo/domain`, `@workampo/i18n`, `react-hook-form` and `@hookform/resolvers`.
- The two moved tests use app-core's unexported `_shared/testing/fake-api.ts` and `hook-wrapper.ts`. Default: `apps/web/src/_shared/testing/hook-wrapper.ts`, the same `fakeApi`, `problem` and `hookWrapper` built on the public `./api-client` and `./api-client-context` (about 45 lines, like `render-app.tsx` already does). The tests change only their imports. See open question 1.
- Layer folders renamed (`git` detects the renames):
  - `apps/api/src/{access,companies}/data/` → `_repo/` (only `*.d1.repo.ts`); imports in the logic files, the two middlewares and `require-session.middleware.int.test.ts`.
  - `packages/app-core/src/{access,companies}/data/` → `_api/` (`*.api.ts`, their tests, `query-keys.ts`); imports in the use-case hooks, `me.hook.ts` and their tests.
- `scripts/conventions/structure-rules.mjs` already accepts `_repo/` and `_api/`: `srcLayoutErrors` checks only the first level under `src/`. Two new file-list rules, wired in `conventions.mjs`:
  - `hookMirrorErrors(files)`: each `packages/app-core/src/<path>/` holding a `.hook.ts` (tests excluded) needs `apps/api/src/<path>/` among the files; a hook directly in `packages/app-core/src/<domain>/` (`me.hook.ts`) is exempt.
  - `layerFolderErrors(files)`: inside a domain, a `.repo.ts` only in a `_repo/` folder and a `.api.ts` (and `.api.test.ts`) only in `_api/`. `apps/api/src/_shared/rate-limit/rate-limit.d1.repo.ts` and `_shared/tenancy/shard.d1.repo.ts` stay where they are: `_shared/` is out of the rule (decided, see Risks).
- `.dependency-cruiser.cjs`, `app-core-has-no-dom`: the rule stays (no DOM, no router, nothing of `apps/web`); the comment no longer says a page hook lives there: app-core is shared with the mobile app, which has its own navigation. `only-api-files-use-the-client` matches `\.api\.ts$`, not `data/`: unchanged. `knip.json` names no `data/`.
- Docs: `docs/procedures/critical-paths.md` (`companies/_repo/member.d1.repo.ts`) goes with the API rename. `docs/process/code-conventions.md`: one "Layout" section (tree per package and app: domain, app-core, ui, i18n, web, api; one example per kind of file; `_repo/`/`_api/` vs `_shared/`; the `_` folder rule); "Pages, hooks and data in the clients" puts the page hook in the app and the data in `_api/`; "Names" says forms and use-case hooks are exported once an app uses them, `*.api.ts` and test helpers stay unexported; `query-keys.ts` lives in `_api/`; "Database" line says `_repo/`; the intro lists the two new checks. A dated Update in `docs/adr/0053-code-conventions.md` (earlier text, and ADR-0075's `<domain>/data/`, not rewritten).

## Data model

No change.

## API contracts

No change.

## Migrations

None.

## Flags

None.

## Analytics events

None.

## Risks

- Critical paths (`apps/api/src/access/**`, `member.d1.repo.ts`): the issue is already `size:L`; the API rename runs at `max` and changes only paths and imports.
- lefthook runs `pnpm check` on every commit and stashes unstaged files. Each task leaves `pnpm check` green on its own. Implementers move with plain `mv` and do not stage; the orchestrator commits the parallel tasks of wave 2 one at a time with `git add -A <Touches>`, so one task's rename never lands in another's commit.
- The new checks land in wave 3, after the renames and the move, so no commit fails them. Wave 1 adds their tests as `{ todo: true }` (node:test has no `it.fails`) and reads the two functions through a namespace import, so the file loads before they exist.
- A missed import fails `typecheck`, a missed export fails the web build; `pnpm e2e` with no scenario changed shows behaviour is the same.
- Open questions for the person:
  1. **(decided, the person 2026-11-25)** Test helpers for the moved hook tests: the web's own `apps/web/src/_shared/testing/hook-wrapper.ts` on the public api-client; app-core exports no test helper.
  2. **(decided, the person 2026-11-25)** The `_shared/` repos (`rate-limit.d1.repo.ts`, `shard.d1.repo.ts`) stay beside their capability; the `_repo/` rule applies only inside domains.
