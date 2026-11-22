import { type AnyRoute, createRouter, type RouterHistory } from '@tanstack/react-router'
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
  return createRouter({ routeTree, context, defaultPreload: 'intent', ...(history && { history }) })
}
