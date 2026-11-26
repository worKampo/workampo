import type { ComponentProps } from 'react'
import { cx } from '../_shared/cx'

// docs/design/components.md, "Banners". Only the negative variant exists so far; tabIndex -1 lets the page focus it on a failed submit.
export function Banner({
  variant,
  className,
  children,
  ...props
}: ComponentProps<'div'> & { variant: 'negative' }) {
  return (
    <div
      role="alert"
      tabIndex={-1}
      className={cx(
        'flex items-start gap-2 rounded-xl border border-neg-border bg-neg-bg px-4 py-3 text-sm text-text',
        className,
      )}
      {...props}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-neg"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16h.01" />
      </svg>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
