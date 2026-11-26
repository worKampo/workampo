import { ErrorReference } from '@workampo/ui/feedback'
import type { ComponentProps } from 'react'

// Loaded only through lazy() in system-pages.tsx, so the tooltip stays out of the entry bundle.
export function CopyableReference(props: ComponentProps<typeof ErrorReference>) {
  return <ErrorReference {...props} />
}
