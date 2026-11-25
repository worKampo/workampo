import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createApiClient } from '@workampo/app-core/api-client'
import { ApiClientProvider } from '@workampo/app-core/api-client-context'
import { createElement, type ReactNode } from 'react'

export type Sent = { method: string; url: string; headers: Headers; body: unknown }

// What renderHook needs to run a page hook: a fresh query cache and a fetch that answers like
// our API, recording what the client sent (never a module mock).
export function hookWrapper(answer: (sent: Sent) => Response) {
  const sent: Sent[] = []
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    const text = await request.text()
    const entry = {
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: text ? JSON.parse(text) : undefined,
    }
    sent.push(entry)

    return answer(entry)
  }
  const client = createApiClient({ baseUrl: 'https://app.test', clientVersion: 'v1', fetch })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(ApiClientProvider, { client, children }),
    )

  return { wrapper, queryClient, sent }
}

export function problem({ status, code }: { status: number; code: string }) {
  return new Response(JSON.stringify({ type: 'about:blank', status, code }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  })
}
