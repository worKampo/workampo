import { createLazyRoute, createRoute, notFound, redirect } from '@tanstack/react-router'
import { meQueryOptions, replaceSession } from '@workampo/app-core/access/me'
import { companyContextQueryOptions } from '@workampo/app-core/companies/workspace/read-context'
import { errorKeyOf } from '@workampo/app-core/errors'
import { rootRoute } from '../../_shared/router/root-route'

const companyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/c/$slug',
  // No session, no app: after signing in the person comes back to the page they asked for
  // (@id:companies-90-13, @id:access-91-1).
  beforeLoad: async ({ context, location }) => {
    const me = await context.queryClient.ensureQueryData(meQueryOptions(context.apiClient))
    if (!me) throw redirect({ to: '/login', search: { returnTo: location.href } })
  },
  // Loaded here rather than on mount: the router fetches once, while the page's query would retry a 404.
  loader: async ({ context, params, location }) => {
    try {
      await context.queryClient.ensureQueryData(
        companyContextQueryOptions(context.apiClient, params.slug),
      )
    } catch (error) {
      if (errorKeyOf(error) === 'companies:errors.not_found') throw notFound()
      // The session expired while me was still cached: the guard let the person in.
      if (errorKeyOf(error) === 'access:errors.unauthenticated') {
        await replaceSession(context.queryClient, null)
        throw redirect({ to: '/login', search: { returnTo: location.href } })
      }
      throw error
    }
  },
}).lazy(() =>
  import('./company-home/company-home.page').then(({ CompanyNotFoundPage }) =>
    createLazyRoute('/c/$slug')({ notFoundComponent: CompanyNotFoundPage }),
  ),
)

const companyHomeRoute = createRoute({ getParentRoute: () => companyRoute, path: '/' }).lazy(() =>
  import('./company-home/company-home.page').then(({ CompanyHomePage }) =>
    createLazyRoute('/c/$slug/')({ component: CompanyHomePage }),
  ),
)

// Subpages that do not exist yet sit under the guard, so a link to one survives signing in; the
// index route outranks this splat for the company home itself.
const companySubpageRoute = createRoute({ getParentRoute: () => companyRoute, path: '$' }).lazy(
  () =>
    import('./company-home/company-home.page').then(({ CompanyPageNotFoundPage }) =>
      createLazyRoute('/c/$slug/$')({ component: CompanyPageNotFoundPage }),
    ),
)

export const workspaceRoute = companyRoute.addChildren([companyHomeRoute, companySubpageRoute])
