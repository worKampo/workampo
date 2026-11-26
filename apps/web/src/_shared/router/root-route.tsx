import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import type { ApiClient } from '@workampo/app-core/api-client'
import { AppLoader } from '@workampo/ui/feedback'
import { useTranslation } from 'react-i18next'
import { ErrorPage, NotFoundPage } from '../system-pages/system-pages'

// Guards read the session through the same cache and client as the screens.
export type RouterContext = { queryClient: QueryClient; apiClient: ApiClient }

// Shown only where there is no layout yet: the root and a company (docs/design/patterns.md, "App shell").
export function RouteLoader() {
  const { t } = useTranslation('common')
  return <AppLoader label={t('states.loading')} />
}

export const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Outlet,
  pendingComponent: RouteLoader,
  pendingMs: 300,
  // Eager, never lazy(): a failed code load must still paint its own 500.
  errorComponent: ErrorPage,
  notFoundComponent: NotFoundPage,
})
