import type { ReactNode } from 'react'

export function SkipLink({ targetId, children }: { targetId: string; children: ReactNode }) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:text-body focus:font-medium focus:text-text focus:shadow-(--shadow-pop) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui"
    >
      {children}
    </a>
  )
}
