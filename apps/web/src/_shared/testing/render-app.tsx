import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory } from '@tanstack/react-router'
import { render } from '@testing-library/react'
import { createApiClient } from '@workampo/app-core/_shared/api-client'
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
  const queryClient = new QueryClient()
  const router = createAppRouter({
    routeTree,
    context: { queryClient, apiClient },
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  render(<AppProviders queryClient={queryClient} apiClient={apiClient} router={router} />)

  return { router }
}

export function problem({ status, code }: { status: number; code: string }) {
  return Response.json({ type: 'about:blank', status, code }, { status })
}
