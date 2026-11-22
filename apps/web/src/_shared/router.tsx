import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'
import { Logo } from '@workampo/ui/logo'

// Code-based routes (ADR-0073): each domain adds its own from its folder.
const rootRoute = createRootRoute({ component: Outlet })

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => (
    <main className="p-4">
      <Logo />
    </main>
  ),
})

export const router = createRouter({ routeTree: rootRoute.addChildren([homeRoute]) })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
