import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext } from '@tanstack/react-router'
import type { ApiClient } from '@workampo/app-core/api-client'
import { AppLoader } from '@workampo/ui/feedback'
import { useTranslation } from 'react-i18next'
import type { LocationPort, ReloadStorage } from '../new-version/reload-on-navigation'
import type { VersionWatch } from '../new-version/version-watch'
import { ErrorPage, NotFoundPage } from '../system-pages/system-pages'
import { RootLayout } from './root-layout'

// Guards read the session through the same cache and client as the screens.
export type RouterContext = {
  queryClient: QueryClient
  apiClient: ApiClient
  versionWatch: VersionWatch
  // The page's own location and sessionStorage, injected so tests can record a reload.
  browser: { location: LocationPort; storage: ReloadStorage }
}

// Shown only where there is no layout yet: the root and a company (docs/design/patterns.md, "App shell").
export function RouteLoader() {
  const { t } = useTranslation('common')
  return <AppLoader label={t('states.loading')} />
}

export const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  pendingComponent: RouteLoader,
  pendingMs: 300,
  // Eager, never lazy(): a failed code load must still paint its own 500.
  errorComponent: ErrorPage,
  notFoundComponent: NotFoundPage,
})
