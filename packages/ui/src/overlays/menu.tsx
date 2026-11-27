import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  type ComponentProps,
  createContext,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useContext,
  useRef,
  useState,
} from 'react'
import { cx } from '../_shared/cx'

// Radix opens on ArrowDown but not ArrowUp; the WAI-ARIA menu button opens on the last item with it.
type MenuContextValue = { focusLast: RefObject<boolean>; open: () => void }
const MenuContext = createContext<MenuContextValue | null>(null)

export function Menu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const focusLast = useRef(false)

  return (
    <MenuContext value={{ focusLast, open: () => setOpen(true) }}>
      {/* Non-modal: the modal one's scroll lock injects a <style> that the CSP blocks. */}
      <DropdownMenu.Root modal={false} open={open} onOpenChange={setOpen}>
        {children}
      </DropdownMenu.Root>
    </MenuContext>
  )
}

export function MenuTrigger({ onKeyDown, ...props }: ComponentProps<typeof DropdownMenu.Trigger>) {
  const menu = useContext(MenuContext)

  return (
    <DropdownMenu.Trigger
      onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
        onKeyDown?.(event)
        if (event.key !== 'ArrowUp' || !menu) return
        event.preventDefault()
        menu.focusLast.current = true
        menu.open()
      }}
      {...props}
    />
  )
}

// docs/design/components.md, "Popover and menu": surface, radius 12, padding 4, min width 200.
export function MenuContent({
  className,
  sideOffset = 4,
  align = 'end',
  ...props
}: ComponentProps<typeof DropdownMenu.Content>) {
  const menu = useContext(MenuContext)

  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        sideOffset={sideOffset}
        align={align}
        collisionPadding={8}
        onFocus={(event) => {
          // Preventing the content's own focus skips Radix's move to the first item.
          if (!menu?.focusLast.current || event.target !== event.currentTarget) return
          menu.focusLast.current = false
          event.preventDefault()
          const items = event.currentTarget.querySelectorAll<HTMLElement>(
            '[role="menuitem"]:not([data-disabled])',
          )
          items[items.length - 1]?.focus()
        }}
        className={cx(
          'z-50 min-w-50 rounded-xl border border-border bg-surface p-1 shadow-(--shadow-pop)',
          className,
        )}
        {...props}
      />
    </DropdownMenu.Portal>
  )
}

export function MenuHeader({ className, ...props }: ComponentProps<typeof DropdownMenu.Label>) {
  return (
    <DropdownMenu.Label
      className={cx('px-2.5 py-2 text-body font-medium text-text', className)}
      {...props}
    />
  )
}

// A busy item is disabled so a second select cannot run its action again; the menu stays open.
export function MenuItem({
  className,
  busy = false,
  disabled,
  ...props
}: ComponentProps<typeof DropdownMenu.Item> & { busy?: boolean }) {
  return (
    <DropdownMenu.Item
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cx(
        'flex h-9 cursor-default items-center gap-2 rounded-lg px-2.5 text-body text-text-1 outline-none select-none',
        'data-highlighted:bg-surface-hover data-highlighted:text-text',
        'data-disabled:cursor-not-allowed data-disabled:text-text-3',
        className,
      )}
      {...props}
    />
  )
}

export function MenuSeparator({
  className,
  ...props
}: ComponentProps<typeof DropdownMenu.Separator>) {
  return (
    <DropdownMenu.Separator className={cx('-mx-1 my-1 h-px bg-border', className)} {...props} />
  )
}
