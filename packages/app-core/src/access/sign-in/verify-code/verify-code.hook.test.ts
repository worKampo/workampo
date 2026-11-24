import { act, renderHook } from '@testing-library/react'
import { expect, it } from 'vitest'
import { hookWrapper } from '../../../_shared/testing/hook-wrapper'
import { ME_QUERY_KEY } from '../../data/query-keys'
import { useVerifyCode } from './verify-code.hook'

it('@id:access-96-2 a verified code leaves the signed-in user in the cache', async () => {
  const user = { id: 'u1', email: 'ana@example.com' }
  const { wrapper, queryClient } = hookWrapper(() => Response.json({ user }, { status: 201 }))
  const { result } = renderHook(() => useVerifyCode(), { wrapper })

  await act(() => result.current.mutateAsync({ email: 'ana@example.com', code: '424242' }))

  expect(queryClient.getQueryData(ME_QUERY_KEY)).toEqual(user)
})
