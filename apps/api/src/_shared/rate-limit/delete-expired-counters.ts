import { rateLimitRepo } from './rate-limit-repo'

// A counter whose window has ended can never block again; the daily cron removes it.
export async function deleteExpiredCounters(env: { DB_GLOBAL: D1Database }, now: Date) {
  await rateLimitRepo(env).deleteExpired(now.toISOString())
}
