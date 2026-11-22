import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { expect, it } from 'vitest'
import { ApiClientProvider } from '../../_shared/api-client-context'
import { fakeApi } from '../../_shared/testing/fake-api'
import { ME_QUERY_KEY } from '../query-keys'
import { useVerifyCode } from './sign-in-hooks'

it('@id:access-96-2 a verified code leaves the signed-in user in the cache', async () => {
  const user = { id: 'u1', email: 'ana@example.com' }
  const { client } = fakeApi(() => Response.json({ user }, { status: 201 }))
  const queryClient = new QueryClient()
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(ApiClientProvider, { client, children }),
    )
  const { result } = renderHook(() => useVerifyCode(), { wrapper })

  await act(() => result.current.mutateAsync({ email: 'ana@example.com', code: '424242' }))

  expect(queryClient.getQueryData(ME_QUERY_KEY)).toEqual(user)
})
