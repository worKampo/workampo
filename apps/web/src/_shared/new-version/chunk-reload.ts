import { useRouter } from '@tanstack/react-router'
import type { LocationPort, ReloadStorage } from './reload-on-navigation'

const MARK = 'workampo:chunk-reload'
// Chromium, Firefox, Safari, and Vite when a chunk's CSS cannot load.
const CHUNK_ERROR =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/

// The page loads that are already reloading: the router may mount the error page more than once.
const reloadingPages = new WeakSet<object>()

// True while this page load reloads after a failed code load, so the error page shows nothing.
export function useReloadAfterChunkError(error: unknown) {
  const { versionWatch, browser } = useRouter().options.context
  if (reloadingPages.has(browser)) return true

  const isReloading = reloadOnceAfterChunkError({
    error,
    ownVersion: versionWatch.ownVersion,
    ...browser,
  })
  if (isReloading) reloadingPages.add(browser)

  return isReloading
}

// A screen's code that fails to load reloads once per build; the second failure shows the 500 (E4, R4).
export function reloadOnceAfterChunkError({
  error,
  ownVersion,
  storage,
  location,
}: {
  error: unknown
  ownVersion: string
  storage: ReloadStorage
  location: LocationPort
}) {
  if (!(error instanceof Error) || !CHUNK_ERROR.test(error.message)) return false

  try {
    if (storage.getItem(MARK) === ownVersion) return false

    storage.setItem(MARK, ownVersion)
  } catch {
    return false
  }

  location.reload()
  return true
}
