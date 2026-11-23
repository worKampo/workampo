import { describe, expect, it } from 'vitest'
import { ApiError, send } from './api-error'
import { fakeApi, problem } from './testing/fake-api'

describe('the API client', () => {
  it('sends the client version on every request, to the base URL', async () => {
    const { client, sent } = fakeApi(() => Response.json({ id: 'u1', email: 'ana@example.com' }))

    await send(() => client.api.me.$get())

    expect(sent[0]?.url).toBe('https://app.test/api/me')
    expect(sent[0]?.headers.get('X-Client-Version')).toBe('v1')
  })

  it('turns a problem+json answer into an ApiError with its code', async () => {
    const { client } = fakeApi(() => problem({ status: 429, code: 'access.too_many_attempts' }))

    const call = send(() => client.api.me.$get())

    await expect(call).rejects.toEqual(
      new ApiError({ code: 'access.too_many_attempts', status: 429 }),
    )
  })

  it('an unknown code, a body that is not a problem or no network is unknown', async () => {
    const answers = [
      () => problem({ status: 400, code: 'billing.other' }),
      () => new Response('<html>', { status: 502 }),
      () => {
        throw new TypeError('offline')
      },
    ]

    for (const answer of answers) {
      const { client } = fakeApi(answer)

      const call = send(() => client.api.me.$get())

      await expect(call).rejects.toMatchObject({ code: 'unknown' })
    }
  })
})
