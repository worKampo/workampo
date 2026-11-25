import type { createAppRouter } from './_shared/router/create-app-router'
import { rootRoute } from './_shared/router/root-route'
import { accessRoutes } from './access/access.route'
import { companiesRoutes } from './companies/companies.route'

// Every domain adds its routes here.
export const routeTree = rootRoute.addChildren([...accessRoutes, ...companiesRoutes])

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter<typeof routeTree>>
  }
}
