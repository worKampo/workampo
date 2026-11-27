import type { VersionWatch } from './version-watch'

// Every API answer, a 4xx or 5xx too, tells the watch which version is deployed.
export function watchedFetch(fetch: typeof globalThis.fetch, watch: Pick<VersionWatch, 'observe'>) {
  return async (...args: Parameters<typeof globalThis.fetch>) => {
    const response = await fetch(...args)
    watch.observe(response.headers)

    return response
  }
}
