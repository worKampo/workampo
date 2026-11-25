import {
  type AnyRoute,
  createRouter,
  defaultStringifySearch,
  type RouterHistory,
} from '@tanstack/react-router'
import type { RouterContext } from './root-route'

export function createAppRouter<TRouteTree extends AnyRoute>({
  routeTree,
  context,
  history,
}: {
  routeTree: TRouteTree
  context: RouterContext
  history?: RouterHistory
}) {
  // Hovering or focusing a link downloads its screen (ADR-0073 point 4).
  return createRouter({
    routeTree,
    context,
    defaultPreload: 'intent',
    // A slash needs no escaping in a query, so returnTo reads as a path: ?returnTo=/c/northwind/.
    stringifySearch: (search) => defaultStringifySearch(search).replaceAll('%2F', '/'),
    ...(history && { history }),
  })
}
