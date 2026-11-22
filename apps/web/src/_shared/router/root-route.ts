import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import type { ApiClient } from '@workampo/app-core/_shared/api-client'

// Guards read the session through the same cache and client as the screens.
export type RouterContext = { queryClient: QueryClient; apiClient: ApiClient }

export const rootRoute = createRootRouteWithContext<RouterContext>()({ component: Outlet })
