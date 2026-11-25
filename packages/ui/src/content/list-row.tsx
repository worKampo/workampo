import { type ComponentProps, type ReactNode, useId } from 'react'
import { cx } from '../_shared/cx'

// docs/design/components.md, "Tables and card lists": a bordered card whose rows divide it.
export function CardList({ className, ...props }: ComponentProps<'ul'>) {
  return (
    <ul
      className={cx(
        'divide-y divide-muted overflow-hidden rounded-xl border border-border bg-surface',
        className,
      )}
      {...props}
    />
  )
}

// A whole row that opens a record; routers wrap it (TanStack Router: createLink(ListRowLink)).
// The secondary line stays out of the link name but describes it: a description may point at hidden text.
export function ListRowLink({
  leading,
  title,
  subtitle,
  className,
  ...props
}: Omit<ComponentProps<'a'>, 'title' | 'children'> & {
  leading?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
}) {
  const id = useId()

  return (
    <a
      aria-describedby={subtitle ? `${id}-subtitle` : undefined}
      className={cx(
        'flex min-h-14 items-center gap-3 p-3 text-body hover:bg-surface-hover',
        // Inset: the card list clips its rows to its rounded corners.
        'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ui',
        className,
      )}
      {...props}
    >
      {leading}
      <span className="flex min-w-0 grow flex-col">
        <span className="font-medium wrap-break-word text-text">{title}</span>
        {subtitle && (
          <span
            id={`${id}-subtitle`}
            aria-hidden="true"
            className="text-xs wrap-break-word text-text-2"
          >
            {subtitle}
          </span>
        )}
      </span>
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="size-4 shrink-0 text-text-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 6l6 6-6 6" />
      </svg>
    </a>
  )
}
