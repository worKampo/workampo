import type { ComponentProps } from 'react'
import { cx } from './cx'

// docs/design/components.md, "Cards and stats": padding 20, 16 on phone.
export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cx('rounded-xl border border-border bg-surface p-4 sm:p-5', className)}
      {...props}
    />
  )
}
