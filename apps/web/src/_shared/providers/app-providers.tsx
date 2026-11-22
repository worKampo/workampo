import { type QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type RegisteredRouter, RouterProvider } from '@tanstack/react-router'
import type { ApiClient } from '@workampo/client/_shared/api-client'
import { ApiClientProvider } from '@workampo/client/_shared/api-client-context'
import { StrictMode } from 'react'

// Library providers only (ADR-0073 point 5): the query cache, the API client and the router.
// i18next needs none: react-i18next reads the instance initI18n set up.
export function AppProviders({
  queryClient,
  apiClient,
  router,
}: {
  queryClient: QueryClient
  apiClient: ApiClient
  router: RegisteredRouter
}) {
  return (
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ApiClientProvider client={apiClient}>
          <RouterProvider router={router} />
        </ApiClientProvider>
      </QueryClientProvider>
    </StrictMode>
  )
}
