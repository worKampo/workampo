import type { BatchItem } from 'drizzle-orm/batch'
import { globalDb } from '../../_shared/db/d1-global-db'

// The writes of one sign-in, from several repos, in one batch(): all of them or none.
export function commitSignIn(env: { DB_GLOBAL: D1Database }, writes: BatchItem<'sqlite'>[]) {
  const [first, ...rest] = writes
  if (!first) throw new Error('a sign-in always writes its session')

  return globalDb(env).batch([first, ...rest])
}
