import { userRepo } from '../../_repo/user.d1.repo'
import { AccessError } from '../../errors'

export async function readMe(env: { DB_GLOBAL: D1Database }, userId: string) {
  const user = await userRepo(env).findById(userId)
  if (!user) throw new AccessError('access.unauthenticated')

  return user
}
