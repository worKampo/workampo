import {
  type ComponentProps,
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { cx } from '../../_shared/cx'
import { MenuScope } from '../../overlays/menu'
import { Tooltip } from '../../overlays/tooltip'
import { SkipLink } from '../skip-link'

export type AppShellLabels = {
  skipToContent: string
  navigation: string
  openNav: string
  closeNav: string
  navDialog: string
  collapse: string
  expand: string
  pin: string
}

// The sidebar, the rail and the side menu render the same slots; each tells its pieces how to show.
type Place = { rail: boolean; onNavigate?: () => void }
const PlaceContext = createContext<Place>({ rail: false })

const LG = '(min-width: 64rem)'
const HOVER_DELAY = 300

const iconButton =
  'inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-text-1 hover:bg-nav-hover hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui max-lg:size-11'

type Slots = {
  company: ReactNode
  nav: ReactNode
  user: ReactNode
  search?: ReactNode
  notifications?: ReactNode
}

// docs/design/patterns.md, "App shell": sidebar 256 / rail 64 on chrome, topbar 56 and a 280 side menu below 1024.
export function AppShell({
  labels,
  collapsed,
  onCollapsedChange,
  topbar,
  children,
  ...slots
}: Slots & {
  labels: AppShellLabels
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  /** What the topbar shows after «Abrir menú»: TopbarCompany. */
  topbar?: ReactNode
  children: ReactNode
}) {
  const [navOpen, setNavOpen] = useState(false)
  const openNav = useRef<HTMLButtonElement>(null)
  const closeNav = useCallback(() => setNavOpen(false), [])

  useEffect(() => {
    if (!navOpen || !window.matchMedia) return
    const wide = window.matchMedia(LG)
    const close = () => wide.matches && setNavOpen(false)
    close()
    wide.addEventListener('change', close)
    return () => wide.removeEventListener('change', close)
  }, [navOpen])

  return (
    <div className="flex min-h-dvh">
      <SkipLink targetId="content">{labels.skipToContent}</SkipLink>

      <Sidebar
        labels={labels}
        collapsed={collapsed}
        onCollapsedChange={onCollapsedChange}
        {...slots}
      />

      <div className="flex min-w-0 grow flex-col px-safe">
        <header className="sticky top-0 z-40 bg-chrome pt-safe lg:hidden">
          <div className="flex h-14 items-center gap-2 ps-1.5 pe-3">
            <button
              ref={openNav}
              type="button"
              aria-label={labels.openNav}
              aria-haspopup="dialog"
              aria-expanded={navOpen}
              onClick={() => setNavOpen(true)}
              className={iconButton}
            >
              <MenuIcon />
            </button>
            <PlaceContext value={{ rail: true }}>
              {topbar}
              {slots.notifications}
            </PlaceContext>
          </div>
        </header>
        {navOpen && (
          <SideMenu label={labels.navDialog} onClose={closeNav} opener={openNav}>
            <PlaceContext value={{ rail: false, onNavigate: closeNav }}>
              <div className="flex shrink-0 items-center gap-1">
                <div className="min-w-0 grow">{slots.company}</div>
                <button
                  type="button"
                  aria-label={labels.closeNav}
                  onClick={closeNav}
                  className={iconButton}
                >
                  <CloseIcon />
                </button>
              </div>
              {/* Notifications are the topbar bell here. */}
              <div className="-m-1 flex min-h-0 grow flex-col gap-4 overflow-y-auto p-1">
                {slots.search}
                <nav aria-label={labels.navigation} className="flex flex-col gap-1">
                  {slots.nav}
                </nav>
              </div>
              <div className="flex shrink-0 flex-col">{slots.user}</div>
            </PlaceContext>
          </SideMenu>
        )}

        <main
          id="content"
          tabIndex={-1}
          className="mx-auto flex w-full max-w-220 flex-col gap-6 px-4 pt-6 pb-16 outline-none max-sm:px-3 max-sm:pt-4 sm:px-8"
        >
          {children}
        </main>
      </div>
    </div>
  )
}

// The desktop sidebar. Collapsed, it is a rail that floats open over the page on a resting mouse, on keyboard
// focus, on «Desplegar» (hover: none) and while a menu inside it is open.
function Sidebar({
  labels,
  collapsed,
  onCollapsedChange,
  company,
  search,
  notifications,
  nav,
  user,
}: Slots & {
  labels: AppShellLabels
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
}) {
  const [hovered, setHovered] = useState(false)
  const [keyboardFocus, setKeyboardFocus] = useState(false)
  // Esc folds the rail until the focus leaves it.
  const [escaped, setEscaped] = useState(false)
  const [menus, setMenus] = useState(0)
  const timer = useRef<number>(undefined)
  const mouseInside = useRef(false)
  const panel = useRef<HTMLDivElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)
  const input = useLastInput()

  const floating = collapsed && (hovered || menus > 0 || (keyboardFocus && !escaped))
  const rail = collapsed && !floating

  useEffect(() => () => window.clearTimeout(timer.current), [])

  // A tap outside folds what «Desplegar» opened.
  useEffect(() => {
    if (!floating) return
    const fold = (event: PointerEvent) =>
      panel.current?.contains(event.target as Node) || setHovered(false)
    document.addEventListener('pointerdown', fold)
    return () => document.removeEventListener('pointerdown', fold)
  }, [floating])

  const onMenuOpenChange = useCallback(
    (open: boolean) => setMenus((count) => count + (open ? 1 : -1)),
    [],
  )

  const hoverLater = (next: boolean) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setHovered(next), HOVER_DELAY)
  }

  // One button that changes with the state, so the focus stays on it when the user folds or pins.
  const buttons = {
    expand: { label: labels.expand, icon: <PanelIcon />, act: () => setHovered(true) },
    pin: { label: labels.pin, icon: <PinIcon />, act: () => onCollapsedChange(false) },
    collapse: {
      label: labels.collapse,
      icon: <PanelIcon />,
      act: () => {
        // Folded under the mouse, the rail stays open until the mouse leaves.
        window.clearTimeout(timer.current)
        setHovered(mouseInside.current)
        onCollapsedChange(true)
      },
    },
  }
  const button = rail ? buttons.expand : buttons[collapsed ? 'pin' : 'collapse']

  return (
    <aside
      onPointerEnter={(event) => {
        if (event.pointerType !== 'mouse') return
        mouseInside.current = true
        hoverLater(true)
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== 'mouse') return
        mouseInside.current = false
        hoverLater(false)
      }}
      // React bubbles focus from portals too, so a menu's focus counts as inside.
      onFocus={() => setKeyboardFocus(input.current === 'keyboard')}
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget)) return
        setKeyboardFocus(false)
        setEscaped(false)
      }}
      onKeyDown={(event) => {
        // An open menu takes the first Esc and prevents its default.
        if (event.key !== 'Escape' || event.defaultPrevented || !floating) return
        window.clearTimeout(timer.current)
        setHovered(false)
        setEscaped(true)
        // The folded rail hides this button where the mouse can hover.
        if (event.target === toggle.current)
          panel.current?.querySelector<HTMLElement>('a[href]')?.focus()
      }}
      className={cx(
        'sticky top-0 z-40 hidden h-dvh shrink-0 lg:block',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <PlaceContext
        value={{
          rail,
          // On touch, choosing an item folds what «Desplegar» opened, as the side menu closes.
          onNavigate: () => input.current === 'touch' && setHovered(false),
        }}
      >
        <MenuScope onOpenChange={onMenuOpenChange} side="top">
          <div
            ref={panel}
            className={cx(
              'flex h-full flex-col gap-4 overflow-hidden bg-chrome py-3 motion-safe:transition-all',
              rail ? 'w-16 items-center px-2' : 'w-64 px-3',
              floating &&
                'absolute inset-y-0 start-0 border-e border-border shadow-(--shadow-drawer-start) rtl:shadow-(--shadow-drawer)',
            )}
          >
            <div className={cx('flex shrink-0 items-center', rail ? 'flex-col gap-2' : 'gap-1')}>
              <div className={rail ? undefined : 'min-w-0 grow'}>{company}</div>
              <button
                ref={toggle}
                type="button"
                aria-label={button.label}
                onClick={button.act}
                className={cx(iconButton, rail && 'can-hover:hidden')}
              >
                {button.icon}
              </button>
            </div>
            <div
              className={cx(
                '-m-1 flex min-h-0 grow flex-col gap-4 overflow-y-auto p-1',
                rail && 'items-center',
              )}
            >
              {(search || notifications) && (
                <div className="flex w-full flex-col items-center gap-1">
                  {search}
                  {notifications}
                </div>
              )}
              <nav
                aria-label={labels.navigation}
                className="flex w-full flex-col items-center gap-1"
              >
                {nav}
              </nav>
            </div>
            <div className={cx('flex w-full shrink-0 flex-col', rail && 'items-center')}>
              {user}
            </div>
          </div>
        </MenuScope>
      </PlaceContext>
    </aside>
  )
}

// The last input: 'keyboard' or the pointer's type. Only keyboard focus holds the rail open.
function useLastInput() {
  const input = useRef('keyboard')

  useEffect(() => {
    const onKey = () => {
      input.current = 'keyboard'
    }
    const onPointer = (event: PointerEvent) => {
      input.current = event.pointerType
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onPointer, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onPointer, true)
    }
  }, [])

  return input
}

// A native modal <dialog>: showModal makes the page inert and traps the focus with no injected styles,
// which the CSP would block. Esc, the scrim and the caller close it by unmounting it.
function SideMenu({
  label,
  onClose,
  opener,
  children,
}: {
  label: string
  onClose: () => void
  opener: RefObject<HTMLElement | null>
  children: ReactNode
}) {
  // State, not a ref: the menus inside portal into it, since everything outside a modal dialog is inert.
  const [dialog, setDialog] = useState<HTMLDialogElement | null>(null)

  // The company link goes first; unmounting removes the dialog without close(), so the focus is given back.
  useEffect(() => {
    if (!dialog) return
    dialog.showModal()
    dialog.querySelector<HTMLElement>('a[href], button')?.focus()
    return () => opener.current?.focus()
  }, [dialog, opener])

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the scrim click has Esc as its keyboard way (onCancel).
    <dialog
      ref={setDialog}
      aria-label={label}
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      // The panel fills the dialog, so only the scrim around it reaches the dialog itself.
      onClick={(event) => event.target === event.currentTarget && onClose()}
      className="fixed inset-y-0 start-0 end-auto h-auto max-h-none w-70 max-w-full border-e border-border bg-chrome text-text shadow-(--shadow-drawer-start) backdrop:bg-scrim rtl:shadow-(--shadow-drawer)"
    >
      <MenuScope container={dialog} side="top">
        <div className="flex h-full flex-col pt-safe ps-safe pb-safe">
          <div className="flex min-h-0 grow flex-col gap-4 p-3">{children}</div>
        </div>
      </MenuScope>
    </dialog>
  )
}

// A link of the navigation; routers wrap it (TanStack Router: createLink(NavItem)).
export function NavItem({
  icon,
  label,
  current = false,
  href,
  className,
  onClick,
  ...props
}: Omit<ComponentProps<'a'>, 'children'> & { icon: ReactNode; label: string; current?: boolean }) {
  const { rail, onNavigate } = useContext(PlaceContext)

  return (
    <a
      href={href}
      aria-current={current ? 'page' : undefined}
      onClick={(event) => {
        onClick?.(event)
        onNavigate?.()
      }}
      className={cx(
        'flex h-9 items-center gap-3 rounded-lg text-body hover:bg-nav-hover hover:text-text max-lg:h-11',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui',
        current ? 'bg-nav-active font-semibold text-text' : 'text-text-1',
        rail ? 'w-10 justify-center' : 'w-full px-2.5',
        className,
      )}
      {...props}
    >
      <span className="flex size-4 shrink-0 items-center justify-center">{icon}</span>
      <span className={rail ? 'sr-only' : 'truncate'}>{label}</span>
    </a>
  )
}

// The company button at the top; its name is cut with an ellipsis and read whole in a tooltip.
// The rail has none: it unfolds with the names.
export function CompanyLink({
  avatar,
  name,
  meta,
  href,
  className,
  onClick,
  ...props
}: Omit<ComponentProps<'a'>, 'children'> & { avatar: ReactNode; name: string; meta?: string }) {
  const { rail, onNavigate } = useContext(PlaceContext)
  const [cut, nameRef] = useIsCut()

  const link = (
    <a
      href={href}
      onClick={(event) => {
        onClick?.(event)
        onNavigate?.()
      }}
      className={cx(
        'flex h-11 min-w-0 items-center gap-3 rounded-lg text-text hover:bg-nav-hover',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui',
        rail ? 'w-12 justify-center' : 'w-full px-2',
        className,
      )}
      {...props}
    >
      {avatar}
      <span className={rail ? 'sr-only' : 'flex min-w-0 flex-col'}>
        <span ref={nameRef} dir="auto" className="truncate text-body leading-4 font-semibold">
          {name}
        </span>
        {meta && (
          <span dir="auto" className="truncate text-xs text-text-2">
            {meta}
          </span>
        )}
      </span>
    </a>
  )

  return (
    <Tooltip content={name} side="bottom" disabled={rail || !cut}>
      {link}
    </Tooltip>
  )
}

// The account button of the sidebar foot (avatar, name and email); the rail keeps the avatar.
// With no name the email takes its place, without a second line. The tooltip follows CompanyLink's rule.
export function UserButton({
  avatar,
  name,
  email,
  className,
  ...props
}: Omit<ComponentProps<'button'>, 'children' | 'name'> & {
  avatar: ReactNode
  name: string | undefined
  email: string
}) {
  const { rail } = useContext(PlaceContext)
  const [cut, nameRef] = useIsCut()

  const button = (
    <button
      type="button"
      className={cx(
        'flex items-center gap-2.5 rounded-lg text-start text-text-1 hover:bg-nav-hover',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui',
        'aria-busy:cursor-progress aria-busy:opacity-60',
        rail ? 'size-11 shrink-0 justify-center' : 'w-full px-2 py-1.5',
        className,
      )}
      {...props}
    >
      {avatar}
      <span className={rail ? 'sr-only' : 'flex min-w-0 flex-col'}>
        <span ref={nameRef} dir="auto" className="truncate text-body font-medium text-text">
          {name ?? email}
        </span>
        {name && (
          <span dir="auto" className="truncate text-xs text-text-2">
            {email}
          </span>
        )}
      </span>
    </button>
  )

  return (
    <Tooltip content={name ?? email} side="top" disabled={rail || !cut}>
      {button}
    </Tooltip>
  )
}

// The company in the topbar: not a stop of its own, the side menu holds the link.
export function TopbarCompany({ avatar, name }: { avatar: ReactNode; name: string }) {
  return (
    <span className="flex min-w-0 grow items-center gap-2">
      {avatar}
      <span dir="auto" className="truncate text-sm font-semibold text-text">
        {name}
      </span>
    </span>
  )
}

// A callback ref: showing the tooltip remounts the link, so each new name element is measured anew.
function useIsCut() {
  const [cut, setCut] = useState(false)

  const ref = useCallback((element: HTMLElement | null) => {
    if (!element) return
    const measure = () => element.isConnected && setCut(element.scrollWidth > element.clientWidth)
    measure()
    // The web font widens the text without resizing its box, which the observer would miss.
    document.fonts?.ready.then(measure)
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return [cut, ref] as const
}

const svg = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  className: 'size-5',
} as const

function MenuIcon() {
  return (
    <svg aria-hidden="true" {...svg}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" {...svg}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

function PanelIcon() {
  return (
    <svg aria-hidden="true" {...svg} className="size-5 rtl:-scale-x-100">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg aria-hidden="true" {...svg}>
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
    </svg>
  )
}
