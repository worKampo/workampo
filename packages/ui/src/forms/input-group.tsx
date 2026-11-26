import type { ComponentProps, ReactNode } from 'react'
import { cx } from '../_shared/cx'

// docs/design/components.md, "Input group": one box, so focus and error styles go on the group.
export function InputGroup({
  prefix,
  className,
  ...props
}: Omit<ComponentProps<'input'>, 'prefix'> & { prefix: ReactNode }) {
  return (
    <div
      className={cx(
        'flex h-9 w-full items-center rounded-lg border border-field-border bg-field-bg text-body',
        'pointer-coarse:h-11 pointer-coarse:text-base hover:border-field-hover-border',
        'focus-within:bg-field-focus focus-within:shadow-(--shadow-focus)',
        'has-aria-invalid:border-neg',
        className,
      )}
    >
      {/* Prevented, the mousedown does not blur the input before it gets the focus. The sibling, not a
          ref: the caller's ref (react-hook-form's register) must reach the input untouched. */}
      <span
        aria-hidden="true"
        dir="ltr"
        className="shrink-0 pl-3 text-text-2 select-none"
        onMouseDown={(event) => {
          event.preventDefault()
          ;(event.currentTarget.nextElementSibling as HTMLInputElement | null)?.focus()
        }}
      >
        {prefix}
      </span>
      <input
        className="h-full min-w-0 flex-1 rounded-r-lg bg-transparent pr-3 text-text focus:outline-none"
        {...props}
      />
    </div>
  )
}
