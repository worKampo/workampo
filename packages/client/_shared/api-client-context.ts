import { createContext, createElement, type ReactNode, useContext } from 'react'
import type { ApiClient } from './api-client'

// A library provider (ADR-0073 point 5): the app creates the client once and the hooks read it.
const ApiClientContext = createContext<ApiClient | null>(null)

export function ApiClientProvider({
  client,
  children,
}: {
  client: ApiClient
  children: ReactNode
}) {
  return createElement(ApiClientContext.Provider, { value: client }, children)
}

export function useApiClient(): ApiClient {
  const client = useContext(ApiClientContext)
  if (!client) throw new Error('useApiClient needs an ApiClientProvider above it')

  return client
}
