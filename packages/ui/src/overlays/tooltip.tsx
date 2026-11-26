import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { type ReactNode, useState } from 'react'

// docs/design/components.md, "Inverted surfaces": ink background, 12/16, padding 6 8, radius 8, 6 px gap.
export function Tooltip({
  content,
  side = 'bottom',
  disabled = false,
  forceOpen = false,
  children,
}: {
  content: ReactNode
  side?: TooltipPrimitive.TooltipContentProps['side']
  // Keeps the trigger mounted while the tooltip may not open, so a focused trigger keeps its focus.
  disabled?: boolean
  // Holds it open whatever the trigger does, e.g. to confirm a click that Radix would close it on.
  forceOpen?: boolean
  children: ReactNode
}) {
  // Controlled, so a tooltip re-enabled while hovered does not pop up without a new interaction.
  const [open, setOpen] = useState(false)
  if (disabled && open) setOpen(false)

  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      <TooltipPrimitive.Root
        open={!disabled && (forceOpen || open)}
        onOpenChange={(next) => setOpen(!disabled && next)}
      >
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
