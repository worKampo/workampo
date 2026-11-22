import { createLazyRoute, createRoute, redirect } from '@tanstack/react-router'
import { meQueryOptions } from '@workampo/client/access/session/hooks'
import { rootRoute } from '../../_shared/router/root-route'

export const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  // No session, no app: the guard sends the person to /login.
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQueryOptions(context.apiClient))
    if (!me) throw redirect({ to: '/login' })
  },
}).lazy(() =>
  import('./home-screen').then(({ HomeScreen }) => createLazyRoute('/')({ component: HomeScreen })),
)
