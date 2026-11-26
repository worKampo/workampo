import type { ComponentProps, ReactNode } from 'react'
import { cx } from '../_shared/cx'

// docs/design/components.md, "Cards and stats": padding 20, 16 on phone.
export function Card({
  heading,
  className,
  children,
  ...props
}: ComponentProps<'div'> & { heading?: ReactNode }) {
  return (
    <div
      className={cx(
        'rounded-xl border border-border bg-surface p-4 sm:p-5',
        heading !== undefined && 'flex flex-col gap-3',
        className,
      )}
      {...props}
    >
      {heading !== undefined && <h2 className="font-semibold text-text">{heading}</h2>}
      {children}
    </div>
  )
}
