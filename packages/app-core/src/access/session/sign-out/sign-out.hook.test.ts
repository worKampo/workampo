import { act, renderHook } from '@testing-library/react'
import { expect, it } from 'vitest'
import { hookWrapper } from '../../../_shared/testing/hook-wrapper'
import { ME_QUERY_KEY } from '../../data/query-keys'
import { useSignOut } from './sign-out.hook'

// Another domain's key, written by hand: access does not import companies' internals.
const companyKey = ['companies', 'context', 'northwind']

it('@id:access-96-14 signing out leaves no user in the cache', async () => {
  const { wrapper, queryClient } = hookWrapper(() => new Response(null, { status: 204 }))
  queryClient.setQueryData(ME_QUERY_KEY, { id: 'u1', email: 'ana@example.com' })
  const { result } = renderHook(() => useSignOut(), { wrapper })

  await act(() => result.current.mutateAsync())

  expect(queryClient.getQueryData(ME_QUERY_KEY)).toBeNull()
})

it('@id:access-96-14 signing out drops the company data the previous person loaded', async () => {
  const { wrapper, queryClient } = hookWrapper(() => new Response(null, { status: 204 }))
  queryClient.setQueryData(companyKey, { name: 'Northwind Logistics' })
  const { result } = renderHook(() => useSignOut(), { wrapper })

  await act(() => result.current.mutateAsync())

  expect(queryClient.getQueryData(companyKey)).toBeUndefined()
})
