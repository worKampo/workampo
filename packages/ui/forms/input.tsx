import type { ComponentProps } from 'react'
import { cx } from '../lib/cx'

// docs/design/components.md, "Fields": 16 px text on touch so iOS does not zoom.
export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={cx(
        'h-9 w-full rounded-lg border border-field-border bg-field-bg px-3 text-[13px] text-text',
        'pointer-coarse:h-11 pointer-coarse:text-base hover:border-field-hover-border',
        'focus:bg-field-focus focus:shadow-[0_0_0_1px_var(--ui),0_0_0_4px_var(--focus-halo)] focus:outline-none',
        'aria-invalid:border-neg',
        className,
      )}
      {...props}
    />
  )
}
