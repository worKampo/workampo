import { describe, expect, it } from 'vitest'
import { fakeApi, problem } from '../../_shared/testing/fake-api'
import { getMe, signOut } from './session-api'

describe('session api', () => {
  it('@id:access-96-2 reads the signed-in user', async () => {
    const user = { id: 'u1', email: 'ana@example.com' }
    const { client } = fakeApi(() => Response.json(user))

    const me = await getMe(client)

    expect(me).toEqual(user)
  })

  it('@id:access-96-15 without a valid session there is no user, not an error', async () => {
    const { client } = fakeApi(() => problem({ status: 401, code: 'access.unauthenticated' }))

    const me = await getMe(client)

    expect(me).toBeNull()
  })

  it('@id:access-96-14 signs out with DELETE', async () => {
    const { client, sent } = fakeApi(() => new Response(null, { status: 204 }))

    await signOut(client)

    expect(sent[0]).toMatchObject({
      method: 'DELETE',
      url: 'https://app.test/api/sessions/current',
    })
  })

  it('@id:access-96-14 an already expired session counts as signed out', async () => {
    const { client } = fakeApi(() => problem({ status: 401, code: 'access.unauthenticated' }))

    const signingOut = signOut(client)

    await expect(signingOut).resolves.toBeUndefined()
  })

  it('a server failure while signing out stays an error', async () => {
    const { client } = fakeApi(() => new Response('down', { status: 503 }))

    const signingOut = signOut(client)

    await expect(signingOut).rejects.toMatchObject({ status: 503 })
  })
})
