PRD #10 · Ticket #144 · Branch: feature/144-api-entrada-logica-y-datos-separados-a

No behaviour change: files are renamed and moved, two endpoints split and one logic file added. `AppType` keeps the same routes.

## Target tree

```
apps/api/src/access/
  access.routes.ts, errors.ts, require-session.middleware.ts
  data/            user.repo.ts, identity.repo.ts, session.repo.ts, sign-in.repo.ts (the atomic sign-in batch)
  sign-in/         sign-in.routes.ts, complete-sign-in.logic.ts, google-state.cookie.ts, linking.int.test.ts
    start-code/    start-code.route.ts, start-code.logic.ts, start-code.int.test.ts
    verify-code/   verify-code.route.ts, verify-code.logic.ts, verify-code.int.test.ts
    google-start/  google-start.route.ts, google-start.logic.ts (+ unit test)
    google-callback/ google-callback.route.ts, google-callback.logic.ts, google-callback.int.test.ts
  session/         session.routes.ts, session.cookie.ts, session-token.logic.ts (+ tests)
    me/            me.route.ts, me.logic.ts (new: reads the user, 401 if gone)
    sign-out/      sign-out.route.ts, sign-out.logic.ts
apps/api/src/_shared/rate-limit/rate-limit.repo.ts (was rate-limit-repo.ts)
```

## Checks

- dependency-cruiser: `database-seam` reads `.repo.ts`; new `route-calls-logic-only` (a `.route.ts` imports no `.repo.ts`) and `logic-without-http` (a `.logic.ts` imports no Hono). The `exclude` option no longer hides packages' `dist/` folders, which hid Hono from every rule.
- Each new rule fails on a probe file.

## Risks

- A route lost in the Google split: `google-callback.int.test.ts` and the e2e cover both endpoints.

## Security

No logic changes; the move keeps `requireSession`, validation, the state cookie and rate limits. Security reviewer at level max.
