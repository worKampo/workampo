import { sessionRepo } from '../session-repo'
import { hashSessionToken } from '../session-token'

export async function signOut(env: { DB_GLOBAL: D1Database }, sessionToken: string) {
  const tokenHash = await hashSessionToken(sessionToken)

  await sessionRepo(env).revokeByTokenHash(tokenHash, new Date().toISOString())
}
