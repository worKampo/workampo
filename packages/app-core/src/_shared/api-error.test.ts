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

// Ticket 93: the reference of a server failure, which the 500 page shows (decisions 2 and 3, X1).
describe('the error reference', () => {
  const answerWith = (status: number, body: Record<string, unknown>) => () =>
    new Response(JSON.stringify({ type: 'about:blank', status, ...body }), {
      status,
      headers: { 'Content-Type': 'application/problem+json' },
    })

  async function failure(answer: () => Response) {
    const { client } = fakeApi(answer)
    const error = await send(() => client.api.me.$get()).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(ApiError)

    return error
  }

  it.fails('a 5xx keeps a valid reference, and anything else has none', async () => {
    const kept = await failure(answerWith(500, { code: 'api.unexpected', reference: '7F3K-92QD' }))
    expect(kept).toMatchObject({ code: 'api.unexpected', status: 500, reference: '7F3K-92QD' })
    expect(
      await failure(answerWith(503, { code: 'api.unexpected', reference: '0000-ZZZZ' })),
    ).toMatchObject({ reference: '0000-ZZZZ' })

    const dropped = [
      answerWith(404, { code: 'api.not_found', reference: '7F3K-92QD' }),
      answerWith(500, { code: 'api.unexpected', reference: '<b>x</b>' }),
      answerWith(500, { code: 'api.unexpected', reference: '7f3k-92qd' }),
      answerWith(500, { code: 'api.unexpected', reference: { value: '7F3K-92QD' } }),
      answerWith(500, { code: 'api.unexpected' }),
      () => new Response('<html>7F3K-92QD</html>', { status: 500 }),
      () => {
        throw new TypeError('offline')
      },
    ]
    for (const answer of dropped) {
      expect(await failure(answer)).toMatchObject({ reference: undefined })
    }
  })
})
