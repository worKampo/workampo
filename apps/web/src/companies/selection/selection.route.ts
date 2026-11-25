import { createLazyRoute, createRoute, redirect } from '@tanstack/react-router'
import { meQueryOptions, replaceSession } from '@workampo/app-core/access/me'
import { myCompaniesQueryOptions } from '@workampo/app-core/companies/selection/list-my-companies'
import { errorKeyOf } from '@workampo/app-core/errors'
import { rootRoute } from '../../_shared/router/root-route'

export const companyPickerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/companies',
  // No session, no app: after signing in the person comes back here (@id:companies-91-2).
  beforeLoad: async ({ context, location }) => {
    const me = await context.queryClient.ensureQueryData(meQueryOptions(context.apiClient))
    if (!me) throw redirect({ to: '/login', search: { returnTo: location.href } })
  },
  loader: async ({ context, location }) => {
    try {
      await context.queryClient.ensureQueryData(myCompaniesQueryOptions(context.apiClient))
    } catch (error) {
      // The session expired while me was still cached: the guard let the person in.
      if (errorKeyOf(error) === 'access:errors.unauthenticated') {
        await replaceSession(context.queryClient, null)
        throw redirect({ to: '/login', search: { returnTo: location.href } })
      }
      throw error
    }
  },
}).lazy(() =>
  import('./company-picker/company-picker.page').then(({ CompanyPickerPage }) =>
    createLazyRoute('/companies')({ component: CompanyPickerPage }),
  ),
)
