import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { problem } from '../../../_shared/testing/fake-api'
import { hookWrapper } from '../../../_shared/testing/hook-wrapper'
import { useMe } from './me.hook'

describe('useMe', () => {
  it('@id:access-96-2 reads the signed-in user', async () => {
    const user = { id: 'u1', email: 'ana@example.com' }
    const { wrapper } = hookWrapper(() => Response.json(user))

    const { result } = renderHook(() => useMe(), { wrapper })

    await waitFor(() => expect(result.current.data).toEqual(user))
  })

  it('@id:access-96-15 gives no user when the session is not valid', async () => {
    const { wrapper } = hookWrapper(() => problem({ status: 401, code: 'access.unauthenticated' }))

    const { result } = renderHook(() => useMe(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
  })
})
