import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { ApiClientProvider } from '../../_shared/api-client-context'
import { fakeApi, problem } from '../../_shared/testing/fake-api'
import { ME_QUERY_KEY, useMe, useSignOut } from './session-hooks'

describe('session hooks', () => {
  it('@id:access-96-2 useMe reads the signed-in user', async () => {
    const user = { id: 'u1', email: 'ana@example.com' }
    const { wrapper } = setUp(() => Response.json(user))

    const { result } = renderHook(() => useMe(), { wrapper })

    await waitFor(() => expect(result.current.data).toEqual(user))
  })

  it('@id:access-96-15 useMe gives no user when the session is not valid', async () => {
    const { wrapper } = setUp(() => problem({ status: 401, code: 'access.unauthenticated' }))

    const { result } = renderHook(() => useMe(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
  })

  it('@id:access-96-14 signing out leaves no user in the cache', async () => {
    const { wrapper, queryClient } = setUp(() => new Response(null, { status: 204 }))
    queryClient.setQueryData(ME_QUERY_KEY, { id: 'u1', email: 'ana@example.com' })
    const { result } = renderHook(() => useSignOut(), { wrapper })

    await act(() => result.current.mutateAsync())

    expect(queryClient.getQueryData(ME_QUERY_KEY)).toBeNull()
  })
})

function setUp(answer: () => Response) {
  const { client } = fakeApi(answer)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(ApiClientProvider, { client, children }),
    )

  return { wrapper, queryClient }
}
