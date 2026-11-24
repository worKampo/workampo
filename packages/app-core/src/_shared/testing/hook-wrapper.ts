import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { ApiClientProvider } from '../api-client-context'
import { fakeApi, type Sent } from './fake-api'

// What renderHook needs to run an app-core hook: a fresh query cache and the fake API.
export function hookWrapper(answer: (sent: Sent) => Response) {
  const { client, sent } = fakeApi(answer)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(ApiClientProvider, { client, children }),
    )

  return { wrapper, queryClient, sent }
}
