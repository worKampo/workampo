import { type ApiClient, ApiError, send } from '../../_shared/api-client'

// No session is a normal state, not an error: the guard sends the person to /login.
export async function getMe(client: ApiClient) {
  try {
    const response = await send(() => client.api.me.$get())

    return await response.json()
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null

    throw error
  }
}

// A session that has already expired is already signed out: the person still leaves.
export async function signOut(client: ApiClient) {
  try {
    await send(() => client.api.sessions.current.$delete())
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return

    throw error
  }
}
