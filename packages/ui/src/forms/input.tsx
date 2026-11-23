import type { ComponentProps } from 'react'
import { cx } from '../_shared/cx'

// docs/design/components.md, "Fields": 16 px text on touch so iOS does not zoom.
export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={cx(
        'h-9 w-full rounded-lg border border-field-border bg-field-bg px-3 text-body text-text',
        'pointer-coarse:h-11 pointer-coarse:text-base hover:border-field-hover-border',
        'focus:bg-field-focus focus:shadow-(--shadow-focus) focus:outline-none',
        'aria-invalid:border-neg disabled:cursor-not-allowed disabled:bg-muted disabled:text-text-3',
        className,
      )}
      {...props}
    />
  )
}
