import { createLazyRoute, createRoute, redirect } from '@tanstack/react-router'
import { meQueryOptions } from '@workampo/app-core/access/me'
import { rootRoute } from '../../_shared/router/root-route'

export const newCompanyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/companies/new',
  // No session, no app: after signing in the person comes back here (@id:companies-90-13). Fetched, not
  // read from the cache: the user that sign-in caches has no name, and the form asks for it.
  beforeLoad: async ({ context, location }) => {
    const me = await context.queryClient.fetchQuery(meQueryOptions(context.apiClient))
    if (!me) throw redirect({ to: '/login', search: { returnTo: location.href } })
  },
}).lazy(() =>
  import('./new-company/new-company.page').then(({ NewCompanyPage }) =>
    createLazyRoute('/companies/new')({ component: NewCompanyPage }),
  ),
)
