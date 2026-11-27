import type { ComponentProps } from 'react'
import { cx } from '../_shared/cx'

// The floating colours lay the translucent tone over an opaque surface, so the page does not show through.
const VARIANTS = {
  negative: {
    role: 'alert',
    colors: 'border-neg-border bg-neg-bg',
    floatingColors: 'border-neg-border bg-surface bg-linear-to-b from-neg-bg to-neg-bg',
    icon: 'text-neg',
    glyph: 'M12 8v5M12 16h.01',
  },
  info: {
    role: 'status',
    colors: 'border-info-border bg-info-bg',
    floatingColors: 'border-info-border bg-surface bg-linear-to-b from-info-bg to-info-bg',
    icon: 'text-info',
    glyph: 'M12 11v5M12 8h.01',
  },
}

// docs/design/components.md, "Banners". Negative takes tabIndex -1 so the page can focus it on a failed submit; info never takes the focus.
export function Banner({
  variant,
  floating = false,
  className,
  children,
  ...props
}: ComponentProps<'div'> & { variant: keyof typeof VARIANTS; floating?: boolean }) {
  const tone = VARIANTS[variant]

  return (
    <div
      role={tone.role}
      tabIndex={variant === 'negative' ? -1 : undefined}
      className={cx(
        'flex items-start gap-2 rounded-xl border px-4 py-3 text-sm text-text',
        floating
          ? cx(
              tone.floatingColors,
              'fixed inset-x-4 bottom-4 z-40 mx-auto mb-safe max-w-110 shadow-(--shadow-float) sm:inset-x-6 sm:bottom-6',
            )
          : tone.colors,
        className,
      )}
      {...props}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className={cx('mt-0.5 size-4 shrink-0', tone.icon)}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d={tone.glyph} />
      </svg>
      <div className="min-w-0 grow">{children}</div>
    </div>
  )
}
