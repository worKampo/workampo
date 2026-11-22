import { createLazyRoute, createRoute } from '@tanstack/react-router'
import { type AccessErrorCode, isAccessErrorCode } from '@workampo/domain/access/errors'
import { rootRoute } from '../../_shared/router/root-route'

declare module '@tanstack/react-router' {
  // The email reaches the code screen in memory, never in the URL (plan, "SPA build and serving").
  interface HistoryState {
    signInEmail?: string
  }
}

export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  // The Google callback sends back only an error code.
  validateSearch: (search: Record<string, unknown>): { error?: AccessErrorCode } =>
    isAccessErrorCode(search.error) ? { error: search.error } : {},
}).lazy(() =>
  import('./login-screen').then(({ LoginScreen }) =>
    createLazyRoute('/login')({ component: LoginScreen }),
  ),
)

export const codeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/login/code' }).lazy(
  () =>
    import('./code-screen').then(({ CodeScreen }) =>
      createLazyRoute('/login/code')({ component: CodeScreen }),
    ),
)
