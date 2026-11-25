import { act, renderHook } from '@testing-library/react'
import { expect, it } from 'vitest'
import { hookWrapper } from '../../../_shared/testing/hook-wrapper'
import { ME_QUERY_KEY } from '../../data/query-keys'
import { useVerifyCode } from './verify-code.hook'

// Another domain's key, written by hand: access does not import companies' internals.
const companyKey = ['companies', 'context', 'northwind']

it('@id:access-96-2 a verified code leaves the signed-in user in the cache', async () => {
  const user = { id: 'u1', email: 'ana@example.com' }
  const { wrapper, queryClient } = hookWrapper(() => Response.json({ user }, { status: 201 }))
  const { result } = renderHook(() => useVerifyCode(), { wrapper })

  await act(() => result.current.mutateAsync({ email: 'ana@example.com', code: '424242' }))

  expect(queryClient.getQueryData(ME_QUERY_KEY)).toEqual(user)
})

it('@id:access-96-2 a new sign-in drops the company data of the previous session', async () => {
  const user = { id: 'u2', email: 'bea@example.com' }
  const { wrapper, queryClient } = hookWrapper(() => Response.json({ user }, { status: 201 }))
  queryClient.setQueryData(companyKey, { name: 'Northwind Logistics' })
  const { result } = renderHook(() => useVerifyCode(), { wrapper })

  await act(() => result.current.mutateAsync({ email: 'bea@example.com', code: '424242' }))

  expect(queryClient.getQueryData(companyKey)).toBeUndefined()
  expect(queryClient.getQueryData(ME_QUERY_KEY)).toEqual(user)
})
