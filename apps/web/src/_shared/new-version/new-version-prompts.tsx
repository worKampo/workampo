import { useRouter, useRouterState } from '@tanstack/react-router'
import { lazy, Suspense, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'

// Lazy to keep them out of the entry bundle; main.tsx preloads them, so they are in memory before a
// later deploy removes the old files. If they still fail, the chunk error reaches the root and E4 reloads.
const loadNotices = () => import('./new-version-notices')
const NewVersionNotice = lazy(() =>
  loadNotices().then(({ NewVersionNotice }) => ({ default: NewVersionNotice })),
)
const OutdatedDialog = lazy(() =>
  loadNotices().then(({ OutdatedDialog }) => ({ default: OutdatedDialog })),
)

export function preloadNewVersionNotices() {
  loadNotices().catch(() => {})
}

// After the screen, so it is the last stop in the tab order; never on the 404 or 500 (E5, E6).
export function NewVersionPrompts() {
  const { t } = useTranslation('common')
  const { versionWatch, browser } = useRouter().options.context
  const { noticeDue, held, outdated } = useSyncExternalStore(
    versionWatch.subscribe,
    versionWatch.getSnapshot,
  )
  // The 404 and 500 render inside the root's component, so it looks for them itself; the router
  // marks a path no route matches with _notFound on the root's match.
  const isSystemPage = useRouterState({
    select: ({ matches }) =>
      matches.some(
        (match) => match.status === 'error' || match.status === 'notFound' || match._notFound,
      ),
  })
  const reload = () => browser.location.reload()
  if (isSystemPage) return null

  return (
    <>
      {/* Always present, so screen readers announce the notice when it appears; no box of its own,
          so the floating notice inside is what shows. */}
      <div role="status" className="contents">
        {noticeDue && !held && !outdated && (
          <Suspense>
            <NewVersionNotice
              labels={{
                text: t('new_version.banner.text'),
                reload: t('new_version.banner.reload'),
              }}
              reload={reload}
            />
          </Suspense>
        )}
      </div>
      {outdated && (
        <Suspense>
          <OutdatedDialog
            labels={{
              title: t('new_version.dialog.title'),
              text: t('new_version.dialog.body'),
              reload: t('new_version.dialog.reload'),
            }}
            reload={reload}
          />
        </Suspense>
      )}
    </>
  )
}
