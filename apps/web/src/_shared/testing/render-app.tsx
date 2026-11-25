import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory } from '@tanstack/react-router'
import { render } from '@testing-library/react'
import { createApiClient } from '@workampo/app-core/api-client'
import { shouldRetry } from '@workampo/app-core/errors'
import { watchSessionExpiry } from '@workampo/app-core/session-expiry'
import { routeTree } from '../../route-tree'
import { AppProviders } from '../providers/app-providers'
import { createAppRouter } from '../router/create-app-router'

// The whole app at `path`, with the API answered by `answer` instead of the network.
export function renderApp({
  path,
  answer,
}: {
  path: string
  answer: (request: Request) => Response | Promise<Response>
}) {
  const apiClient = createApiClient({
    baseUrl: 'https://app.test',
    clientVersion: 'test',
    fetch: async (input, init) => answer(new Request(input, init)),
  })
  // As main.tsx: a 4xx is final, so an expired session shows at once.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: shouldRetry } } })
  const router = createAppRouter({
    routeTree,
    context: { queryClient, apiClient },
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  watchSessionExpiry(queryClient, () => router.invalidate())
  render(<AppProviders queryClient={queryClient} apiClient={apiClient} router={router} />)

  return { router, queryClient }
}

export function problem({ status, code }: { status: number; code: string }) {
  return Response.json({ type: 'about:blank', status, code }, { status })
}

// A session that ends on the server after the app cached me: later calls to /api/me answer 401 too.
export function sessionEndsAfterFirstMe(
  answer: (request: Request) => Response | Promise<Response>,
) {
  let meCalls = 0
  return (request: Request) =>
    new URL(request.url).pathname === '/api/me' && meCalls++ > 0
      ? problem({ status: 401, code: 'access.unauthenticated' })
      : answer(request)
}
