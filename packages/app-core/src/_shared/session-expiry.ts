import type { QueryClient } from '@tanstack/react-query'
import { errorKeyOf } from './error-key'

// A query answered 401 means the cache outlived the session: drop it all, so the guards ask the
// server again who is signed in (nobody) instead of trusting a stale me.
export function watchSessionExpiry(queryClient: QueryClient, onExpired: () => void) {
  return queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.action.type !== 'error') return
    if (errorKeyOf(event.action.error) !== 'access:errors.unauthenticated') return
    // Deferred: removing now would cancel the failing fetch, and its caller would see CancelledError.
    setTimeout(() => {
      queryClient.removeQueries()
      onExpired()
    })
  })
}
