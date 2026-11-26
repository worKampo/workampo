import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'

// docs/design/components.md, "Inverted surfaces": ink background, 12/16, padding 6 8, radius 8, 6 px gap.
export function Tooltip({
  content,
  side = 'bottom',
  children,
}: {
  content: ReactNode
  side?: TooltipPrimitive.TooltipContentProps['side']
  children: ReactNode
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={6}
            className="z-50 max-w-xs rounded-lg bg-text px-2 py-1.5 text-xs text-bg"
          >
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}
