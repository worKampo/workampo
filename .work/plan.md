PRD #10 · Ticket #132 · Branch: feature/132-api-una-carpeta-por-endpoint-y-archivos

No behaviour change: files move and route files are split. The contract `AppType` keeps the same routes, so `hc` types do not change.

## Target tree

```
apps/api/src/
  _shared/identity/                  capability: the identity provider seam and its adapters (was _shared/auth)
    identity-provider.ts             interface and neutral errors
    identity-provider.contract.ts
    provider-registry.ts (+test)
    workos-provider.ts (+test)
    fake-provider.ts (+test), fake-identities.ts, fake-consent.ts (+int test)
  access/
    routes.ts                        lists the features
    errors.ts
    require-session.ts               the middleware other domains will use (top-level file of the domain)
    session/
      session-routes.ts              lists the endpoints only
      session-cookie.ts (+test), session-repo.ts, session-token.ts (+test)
      me/me-route.ts                 GET /me
      sign-out/sign-out-route.ts     DELETE /sessions/current, with sign-out.ts
    sign-in/
      sign-in-routes.ts              lists the endpoints only
      complete-sign-in.ts (+int test), identity-repo.ts, sign-in-repo.ts, linking.int.test.ts
      start-code/                    POST /sign-in-codes: start-code-route.ts, start-code-sign-in.ts (+int test)
      verify-code/                   POST /sessions: verify-code-route.ts, complete-code-sign-in.ts, sign-in-code.int.test.ts
      google/                        GET /sessions/google and its callback: google-routes.ts, start-google-sign-in.ts,
                                     complete-google-sign-in.ts, state-cookie.ts, tests
    users/user-repo.ts
packages/domain/src/_shared/
  identity.ts                        VerifiedIdentity, IdentityProviderKey (was access/identity.ts)
  choose-provider.ts (+test)         generic provider choice (was access/sign-in/)
```

## Decisions

- **`_shared/auth` splits in two.** The identity provider is a capability with adapters (ADR-0053: adapters live in `_shared/<capability>/`), so it stays in `_shared/`, renamed `identity/` for what it does. The session (cookie, token, repo, middleware) is the access domain's own entity and moves to `access/session/`; that also takes a repo out of `_shared/`.
- **What `_shared/identity` reads from `packages/domain`** (`VerifiedIdentity`, `IdentityProviderKey`, `chooseProvider`) describes the seam, not a business rule of access, so it moves to `packages/domain/src/_shared/`. With that, `shared-not-from-domains` can cover every package's domain folders.
- **`requireSession`** sits at the root of `access/`: other domains may only import top-level files of a domain (ADR-0053), and companies will need it.
- **Each endpoint is a `<use-case>-route.ts`** exporting a `Hono` sub-app with its one route; the feature's routes file chains them with `.route('/', …)`, which keeps the RPC types.

## Docs and checks

- `critical-paths.md`: `apps/*/src/_shared/auth/**` becomes `apps/*/src/_shared/identity/**` (session code is already under `apps/*/src/access/**`).
- `scripts/build/no-fake-provider.mjs`, `scripts/checks/size.test.mjs` and the `identity-provider-seam` rule of dependency-cruiser follow the new path.
- `shared-not-from-domains` widened to any package's domain folders.
- `code-conventions.md` and the dated Updates of ADR-0053, ADR-0063 and ADR-0071 name the new paths; the rule "domain → feature → endpoint" is written with its i#111 check.

## Risks

- A route lost or duplicated in the split: the integration tests and the e2e suite call every endpoint; `AppType` is compared before and after with `tsc`.
- The fake provider leaking into stg or prod: `no-fake-provider.mjs` keeps checking the bundle with the new path.

## Security

No logic changes in session, cookies or sign-in; the security reviewer checks that the move keeps every guard (`requireSession`, state cookie, rate limits, the fake's build flag).
