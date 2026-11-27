import '@workampo/ui/styles.css'
import { QueryClient } from '@tanstack/react-query'
import { createApiClient } from '@workampo/app-core/api-client'
import { shouldRetry } from '@workampo/app-core/errors'
import { watchSessionExpiry } from '@workampo/app-core/session-expiry'
import { createRoot } from 'react-dom/client'
import { initI18n } from './_shared/i18n/i18n'
import { preloadNewVersionNotices } from './_shared/new-version/new-version-prompts'
import { createVersionWatch } from './_shared/new-version/version-watch'
import { watchedFetch } from './_shared/new-version/watched-fetch'
import { AppProviders } from './_shared/providers/app-providers'
import { createAppRouter } from './_shared/router/create-app-router'
import { routeTree } from './route-tree'

// zod's first parse probes `new Function`, which script-src 'self' reports as a violation (#199). zod only
// parses in forms, after the person acts, so a lazy import keeps it out of the entry bundle.
void import('zod/v4/core').then(({ config }) => config({ jitless: true }))

await initI18n(navigator.languages)

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: shouldRetry } } })
const versionWatch = createVersionWatch({
  ownVersion: import.meta.env.VITE_APP_VERSION ?? 'dev',
  ownBuildDate: import.meta.env.VITE_APP_BUILD_DATE,
  timers: {
    setTimeout: (run, ms) => window.setTimeout(run, ms),
    clearTimeout: (handle) => window.clearTimeout(handle),
  },
})
const apiClient = createApiClient({
  baseUrl: window.location.origin,
  clientVersion: versionWatch.ownVersion,
  fetch: watchedFetch((input, init) => fetch(input, init), versionWatch),
})
const router = createAppRouter({
  routeTree,
  context: {
    queryClient,
    apiClient,
    versionWatch,
    browser: {
      location: window.location,
      // Read on each call: a blocked storage throws even on access, and the reload code catches it.
      storage: {
        getItem: (key) => window.sessionStorage.getItem(key),
        setItem: (key, value) => window.sessionStorage.setItem(key, value),
      },
    },
  },
})
watchSessionExpiry(queryClient, () => router.invalidate())

const root = document.getElementById('root')
if (!root) throw new Error('index.html has no #root')

createRoot(root).render(
  <AppProviders queryClient={queryClient} apiClient={apiClient} router={router} />,
)
preloadNewVersionNotices()
