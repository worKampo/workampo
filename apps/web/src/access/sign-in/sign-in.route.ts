import { createLazyRoute, createRoute, redirect } from '@tanstack/react-router'
import { meQueryOptions } from '@workampo/app-core/access/me'
import { type AccessErrorCode, isAccessErrorCode } from '@workampo/domain/access/errors'
import { safeReturnTo } from '@workampo/domain/access/sign-in/return-to'
import { rootRoute } from '../../_shared/router/root-route'

declare module '@tanstack/react-router' {
  // The email reaches the code screen in memory: personal data never goes in a URL (@id:access-96-1).
  interface HistoryState {
    signInEmail?: string
    signInReturnTo?: string | undefined
  }
}

export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  // The Google callback sends back only an error code; returnTo is the page that asked for a session.
  // Both keys always present: the router spreads the raw search under this result, so an omitted
  // key would keep its unchecked value.
  validateSearch: (
    search: Record<string, unknown>,
  ): { error?: AccessErrorCode | undefined; returnTo?: string | undefined } => ({
    error: isAccessErrorCode(search.error) ? search.error : undefined,
    returnTo: safeReturnTo(search.returnTo),
  }),
  // Already signed in: no form, straight to the page that asked or to the entry destination.
  beforeLoad: async ({ context, search }) => {
    const me = await context.queryClient.ensureQueryData(meQueryOptions(context.apiClient))
    if (me) throw search.returnTo ? redirect({ href: search.returnTo }) : redirect({ to: '/' })
  },
}).lazy(() =>
  import('./login/login.page').then(({ LoginPage }) =>
    createLazyRoute('/login')({ component: LoginPage }),
  ),
)

export const codeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/login/code' }).lazy(
  () =>
    import('./code/code.page').then(({ CodePage }) =>
      createLazyRoute('/login/code')({ component: CodePage }),
    ),
)
