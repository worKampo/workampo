import type { ComponentProps } from 'react'
import { cx } from '../_shared/cx'

// An inline link in body text; routers wrap it (TanStack Router: createLink(TextLink)).
export function TextLink({ className, ...props }: ComponentProps<'a'>) {
  return (
    <a
      className={cx(
        'text-sm text-text-1 underline underline-offset-4 hover:text-text',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui',
        className,
      )}
      {...props}
    />
  )
}
