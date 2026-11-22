import './app.css'
import { QueryClient } from '@tanstack/react-query'
import { createApiClient } from '@workampo/client/_shared/api-client'
import { createRoot } from 'react-dom/client'
import { initI18n } from './_shared/i18n/i18n'
import { AppProviders } from './_shared/providers/app-providers'
import { createAppRouter } from './_shared/router/create-app-router'
import { routeTree } from './route-tree'

await initI18n(navigator.languages)

const queryClient = new QueryClient()
const apiClient = createApiClient({
  baseUrl: window.location.origin,
  clientVersion: import.meta.env.VITE_APP_VERSION ?? 'dev',
  fetch: (input, init) => fetch(input, init),
})
const router = createAppRouter({ routeTree, context: { queryClient, apiClient } })

const root = document.getElementById('root')
if (!root) throw new Error('index.html has no #root')

createRoot(root).render(
  <AppProviders queryClient={queryClient} apiClient={apiClient} router={router} />,
)
