PRD #10 · Ticket #146 · Branch: feature/146-web-y-app-core-pantalla-hooks-de

No visible change in the web; `AppType` keeps its routes. Size L because it touches `apps/api/src/access/**`.

## Target

- **API**: route lists become `access.router.ts`, `sign-in.router.ts`, `session.router.ts`; repos `access/data/*.d1.repo.ts` and `_shared/rate-limit/rate-limit.d1.repo.ts`; `_shared/http/cloudflare-request-origin.ts` (the neutral `RequestOrigin` type stays in `request-origin.ts`) and `cloudflare-version.ts` (`deployedSha`, `versionId`).
- **app-core**: `access/data/{sign-in,session}.api.ts` and `query-keys.ts`; endpoint hooks `start-code.hook.ts`, `verify-code.hook.ts`, `me.hook.ts`, `sign-out.hook.ts` with `start-code.form.ts`, `verify-code.form.ts`; page hooks `login/login.hook.ts` (`useLoginPage`) and `code/code.hook.ts` (`useCodePage`), which return i18n keys and take navigation as a callback; `_shared/testing/hook-wrapper.ts` for hook tests. `react-hook-form` and its resolver become peer dependencies.
- **web**: `access.route.ts`, `sign-in.route.ts`, `home.route.ts`; pages `login/login.page.tsx`, `code/code.page.tsx` with its piece `code-form.tsx`, `home/home.page.tsx`.

## Checks

dependency-cruiser, each rule failing on a probe file: pages only from their own route file and lazily (renamed from the screen rules); a page's pieces stay in its folder; the apps never import `hono`; in app-core only `.api.ts` and the client module use `hono/client`; app-core imports no router; a file that uses D1 says `d1` in its name.

## Risks

- A page losing a behaviour when its logic moves to its hook: the web tests (`sign-in.route.test.tsx`, `sign-out-button.test.tsx`) cover every message, reset and navigation.

## Security

No logic changes; the reviewer checks that the sign-in pages keep their behaviour and that the moved Cloudflare and D1 code is the same.
