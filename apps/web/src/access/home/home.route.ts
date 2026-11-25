import { createRoute, redirect } from '@tanstack/react-router'
import { meQueryOptions } from '@workampo/app-core/access/me'
import { myCompaniesQueryOptions } from '@workampo/app-core/companies/selection/list-my-companies'
import { entryDestination } from '@workampo/domain/companies/selection/entry-destination'
import { inAppPath } from '../../_shared/router/in-app-path'
import { rootRoute } from '../../_shared/router/root-route'

// No page: / only sends the person where they start (@id:companies-91-7).
export const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQueryOptions(context.apiClient))
    // No returnTo: / is where everyone lands anyway (@id:companies-91-8).
    if (!me) throw redirect({ to: '/login' })
    // Fetched, not read from the cache: a company created a moment ago must count.
    const destination = entryDestination(
      await context.queryClient.fetchQuery(myCompaniesQueryOptions(context.apiClient)),
    )
    if (destination.kind === 'create') throw redirect({ to: '/companies/new' })
    if (destination.kind === 'choose') throw redirect({ to: '/companies' })
    const path = inAppPath(destination.url)
    if (path) throw redirect({ href: path })
    window.location.assign(destination.url)
  },
})
