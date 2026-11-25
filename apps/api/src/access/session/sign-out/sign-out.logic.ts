import { sessionRepo } from '../../_repo/session.d1.repo'
import { hashSessionToken } from '../session-token.logic'

export async function signOut(env: { DB_GLOBAL: D1Database }, sessionToken: string) {
  const tokenHash = await hashSessionToken(sessionToken)

  await sessionRepo(env).revokeByTokenHash(tokenHash, new Date().toISOString())
}
