import { createLazyRoute, createRoute, notFound, redirect } from '@tanstack/react-router'
import { meQueryOptions } from '@workampo/app-core/access/me'
import { companyContextQueryOptions } from '@workampo/app-core/companies/workspace/read-context'
import { errorKeyOf } from '@workampo/app-core/errors'
import { rootRoute } from '../../_shared/router/root-route'

export const workspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/c/$slug',
  // No session, no app: the guard sends the person to /login (@id:companies-90-13).
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQueryOptions(context.apiClient))
    if (!me) throw redirect({ to: '/login' })
  },
  // Loaded here rather than on mount: the router fetches once, while the page's query would retry a 404.
  loader: async ({ context, params }) => {
    try {
      await context.queryClient.ensureQueryData(
        companyContextQueryOptions(context.apiClient, params.slug),
      )
    } catch (error) {
      if (errorKeyOf(error) === 'companies:errors.not_found') throw notFound()
      throw error
    }
  },
}).lazy(() =>
  import('./company-home/company-home.page').then(({ CompanyHomePage, CompanyNotFoundPage }) =>
    createLazyRoute('/c/$slug')({
      component: CompanyHomePage,
      notFoundComponent: CompanyNotFoundPage,
    }),
  ),
)
