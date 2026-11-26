import type { ReactNode } from 'react'
import { cx } from '../_shared/cx'

const ALIGNS = { stretch: '', start: 'items-start' }

// A page inside the app shell: its h1 and its content stacked. The title may hold a name in any script.
export function Page({
  title,
  align = 'stretch',
  children,
}: {
  title: ReactNode
  align?: keyof typeof ALIGNS
  children: ReactNode
}) {
  return (
    <div className={cx('flex flex-col gap-6', ALIGNS[align])}>
      <h1 dir="auto" className="text-xl font-semibold wrap-anywhere text-text">
        {title}
      </h1>
      {children}
    </div>
  )
}
