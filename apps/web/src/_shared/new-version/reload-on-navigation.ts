import { type AnyRouter, type BlockerFn, useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'
import { inAppPath } from '../router/in-app-path'
import type { VersionWatch } from './version-watch'

// Holds the hashes already reloaded to, so versions served in turn reload once each (R3).
const MARK = 'workampo:version-reload'
const MARK_SIZE = 10

// What a reload touches; main.tsx passes window.location, tests a recorder.
export type LocationPort = { origin: string; assign: (url: string) => void; reload: () => void }

export type ReloadStorage = Pick<Storage, 'getItem' | 'setItem'>

// With a new version, the next navigation to another screen is a full load of its destination (E1).
export function reloadOnNavigation({
  router,
  watch,
  storage,
  location,
}: {
  router: AnyRouter
  watch: VersionWatch
  storage: ReloadStorage
  location: LocationPort
}) {
  const reloadInstead = (from: string, to: { pathname: string; href: string }) => {
    const { pending, held } = watch.getSnapshot()
    if (!pending || held || from === to.pathname || !markReload(storage, pending)) return false

    // Only an in-app path of our origin, never a URL from a header or a parameter (R5).
    const path = inAppPath(to.href)
    if (path === undefined) location.reload()
    else
      location.assign(new URL(path + new URL(to.href, location.origin).hash, location.origin).href)

    return true
  }

  const blockerFn: BlockerFn = ({ currentLocation, nextLocation }) =>
    reloadInstead(currentLocation.pathname, nextLocation)
  router.history.block({ blockerFn, enableBeforeUnload: false })
  // The memory history lets back and forward through without asking the blocker.
  router.subscribe('onBeforeNavigate', ({ fromLocation, toLocation }) => {
    if (fromLocation) reloadInstead(fromLocation.pathname, toLocation)
  })
}

// While `active` (a save bar with unsaved changes), no reload and no notice (E3).
export function useHoldNewVersion(active: boolean) {
  const { versionWatch } = useRouter().options.context

  useEffect(() => (active ? versionWatch.hold() : undefined), [active, versionWatch])
}

// False when the hash was already reloaded to, or the storage cannot record it: never a loop (R3, R4).
function markReload(storage: ReloadStorage, version: string) {
  try {
    const reloaded = storage.getItem(MARK)?.split(' ') ?? []
    if (reloaded.includes(version)) return false

    storage.setItem(MARK, [...reloaded, version].slice(-MARK_SIZE).join(' '))
    return true
  } catch {
    return false
  }
}
