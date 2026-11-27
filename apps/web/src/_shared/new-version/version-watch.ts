import { isBelowMinimum, newVersionServed } from '@workampo/domain/_shared/client-version'

const NOTICE_AFTER_MS = 30 * 60_000

export type Timers = {
  setTimeout: (run: () => void, ms: number) => number
  clearTimeout: (handle: number) => void
}

export type VersionSnapshot = {
  pending: string | undefined
  noticeDue: boolean
  outdated: boolean
  held: boolean
}

export type VersionWatch = ReturnType<typeof createVersionWatch>

// What the API answers say about the deployed SPA; a store for useSyncExternalStore. It never reloads.
export function createVersionWatch({
  ownVersion,
  ownBuildDate,
  timers,
}: {
  ownVersion: string
  ownBuildDate: string | undefined
  timers: Timers
}) {
  const listeners = new Set<() => void>()
  let snapshot: VersionSnapshot = {
    pending: undefined,
    noticeDue: false,
    outdated: false,
    held: false,
  }
  let holders = 0
  let noticeTimer: number | undefined
  const update = (change: Partial<VersionSnapshot>) => {
    snapshot = { ...snapshot, ...change }
    for (const listener of listeners) listener()
  }
  const setPending = (pending: string | undefined) => {
    if (pending === snapshot.pending) return

    if (noticeTimer !== undefined) timers.clearTimeout(noticeTimer)
    noticeTimer = pending
      ? timers.setTimeout(() => update({ noticeDue: true }), NOTICE_AFTER_MS)
      : undefined
    update({ pending, noticeDue: false })
  }

  return {
    ownVersion,
    observe(headers: Headers) {
      const served = headers.get('X-App-Version')
      if (served !== null) setPending(newVersionServed(ownVersion, served))
      if (!snapshot.outdated && isBelowMinimum(ownBuildDate, headers.get('X-Min-Client-Version')))
        update({ outdated: true })
    },
    hold() {
      holders++
      update({ held: true })
      let isReleased = false

      return () => {
        if (isReleased) return

        isReleased = true
        holders--
        update({ held: holders > 0 })
      }
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getSnapshot: () => snapshot,
  }
}
