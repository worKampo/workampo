import { describe, expect, it } from 'vitest'
import { fakeApi, problem } from '../../test-support'
import { startCodeSignIn, verifyCode } from './api'

describe('sign-in api', () => {
  it('@id:access-96-1 asks for a code with the email', async () => {
    const { client, sent } = fakeApi(() => new Response(null, { status: 202 }))

    await startCodeSignIn(client, { email: 'ana@example.com' })

    expect(sent[0]).toMatchObject({
      method: 'POST',
      url: 'https://app.test/api/sign-in-codes',
      body: { email: 'ana@example.com' },
    })
  })

  it('@id:access-96-2 the right code returns the user', async () => {
    const user = { id: 'u1', email: 'ana@example.com' }
    const { client, sent } = fakeApi(() => Response.json({ user }, { status: 201 }))

    const signedIn = await verifyCode(client, { email: 'ana@example.com', code: '424242' })

    expect(signedIn).toEqual(user)
    expect(sent[0]).toMatchObject({ url: 'https://app.test/api/sessions', method: 'POST' })
  })

  it('@id:access-96-3 a wrong code is an ApiError with access.invalid_code', async () => {
    const { client } = fakeApi(() => problem({ status: 400, code: 'access.invalid_code' }))

    const call = verifyCode(client, { email: 'ana@example.com', code: '111111' })

    await expect(call).rejects.toMatchObject({ code: 'access.invalid_code', status: 400 })
  })
})
