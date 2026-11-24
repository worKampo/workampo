import type { ComponentProps } from 'react'
import { cx } from '../_shared/cx'

// docs/design/components.md, "Fields": same box as Input, chevron at the right, padding-right 32.
export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select
        className={cx(
          'h-9 w-full appearance-none rounded-lg border border-field-border bg-field-bg pr-8 pl-3 text-body text-text',
          'pointer-coarse:h-11 pointer-coarse:text-base hover:border-field-hover-border',
          'focus:bg-field-focus focus:shadow-(--shadow-focus) focus:outline-none',
          'aria-invalid:border-neg disabled:cursor-not-allowed disabled:bg-muted disabled:text-text-3',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-text-2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m4 6 4 4 4-4" />
      </svg>
    </div>
  )
}
