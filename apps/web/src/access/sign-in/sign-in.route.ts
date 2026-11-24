import { createLazyRoute, createRoute } from '@tanstack/react-router'
import { type AccessErrorCode, isAccessErrorCode } from '@workampo/domain/access/errors'
import { rootRoute } from '../../_shared/router/root-route'

declare module '@tanstack/react-router' {
  // The email reaches the code screen in memory: personal data never goes in a URL (@id:access-96-1).
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
