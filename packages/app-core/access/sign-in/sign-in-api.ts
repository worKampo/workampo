import { type ApiClient, send } from '../../_shared/api-client'

export async function startCodeSignIn(client: ApiClient, { email }: { email: string }) {
  await send(() => client.api['sign-in-codes'].$post({ json: { email } }))
}

export async function verifyCode(client: ApiClient, input: { email: string; code: string }) {
  const response = await send(() => client.api.sessions.$post({ json: input }))
  const { user } = await response.json()

  return user
}
