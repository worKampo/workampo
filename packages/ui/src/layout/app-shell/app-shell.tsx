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
}

// The sidebar, the rail and the side menu render the same slots; each tells its pieces how to show.
type Place = { rail: boolean; onNavigate?: () => void }
const PlaceContext = createContext<Place>({ rail: false })

const LG = '(min-width: 64rem)'

const iconButton =
  'inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-text-1 hover:bg-nav-hover hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui max-lg:size-11'

// docs/design/patterns.md, "App shell": sidebar 256 / rail 64 on chrome, topbar 56 and a 280 side menu below 1024.
export function AppShell({
  labels,
  collapsed,
  onCollapsedChange,
  company,
  nav,
  user,
  topbar,
  children,
}: {
  labels: AppShellLabels
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  company: ReactNode
  nav: ReactNode
  user: ReactNode
  /** What the topbar shows after «Abrir menú»: TopbarCompany and a compact UserButton. */
  topbar?: ReactNode
  children: ReactNode
}) {
  const [navOpen, setNavOpen] = useState(false)
  const openNav = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!navOpen || !window.matchMedia) return
    const wide = window.matchMedia(LG)
    const close = () => wide.matches && setNavOpen(false)
    close()
    wide.addEventListener('change', close)
    return () => wide.removeEventListener('change', close)
  }, [navOpen])

  return (
    <div className="flex min-h-dvh bg-bg">
      <SkipLink targetId="content">{labels.skipToContent}</SkipLink>

      <PlaceContext value={{ rail: collapsed }}>
        <aside
          className={cx(
            'sticky top-0 hidden h-dvh shrink-0 flex-col gap-4 bg-chrome py-3 lg:flex',
            collapsed ? 'w-16 items-center px-2' : 'w-64 px-3',
          )}
        >
          {company}
          <nav aria-label={labels.navigation} className="flex w-full flex-col items-center gap-1">
            {nav}
          </nav>
          <div className={cx('mt-auto flex w-full flex-col gap-1', collapsed && 'items-center')}>
            {user}
            <Tooltip content={collapsed ? labels.expand : labels.collapse} side="right">
              <button
                type="button"
                aria-label={collapsed ? labels.expand : labels.collapse}
                onClick={() => onCollapsedChange(!collapsed)}
                className={cx(iconButton, !collapsed && 'self-end')}
              >
                <PanelIcon />
              </button>
            </Tooltip>
          </div>
        </aside>
      </PlaceContext>

      <div className="flex min-w-0 grow flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-2 bg-chrome ps-1.5 pe-3 lg:hidden">
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
          <PlaceContext value={{ rail: true }}>{topbar}</PlaceContext>
        </header>
        {navOpen && (
          <SideMenu label={labels.navDialog} onClose={() => setNavOpen(false)} opener={openNav}>
            <PlaceContext value={{ rail: false, onNavigate: () => setNavOpen(false) }}>
              <div className="flex items-center gap-1">
                <div className="min-w-0 grow">{company}</div>
                <button
                  type="button"
                  aria-label={labels.closeNav}
                  onClick={() => setNavOpen(false)}
                  className={iconButton}
                >
                  <CloseIcon />
                </button>
              </div>
              <nav aria-label={labels.navigation} className="flex flex-col gap-1">
                {nav}
              </nav>
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
  const dialog = useRef<HTMLDialogElement>(null)

  // The company link goes first; unmounting removes the dialog without close(), so the focus is given back.
  useEffect(() => {
    dialog.current?.showModal()
    dialog.current?.querySelector<HTMLElement>('a[href], button')?.focus()
    return () => opener.current?.focus()
  }, [opener])

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the scrim click has Esc as its keyboard way (onCancel).
    <dialog
      ref={dialog}
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
      <div className="flex min-h-full flex-col gap-4 p-3">{children}</div>
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
  const link = (
    <a
      href={href}
      aria-current={current ? 'page' : undefined}
      onClick={(event) => {
        onClick?.(event)
        onNavigate?.()
      }}
      className={cx(
        'flex h-9 items-center gap-3 rounded-lg text-body text-text-1 hover:bg-nav-hover hover:text-text max-lg:h-11',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui',
        current && 'bg-nav-active font-semibold text-text shadow-xs ring-1 ring-border',
        rail ? 'w-10 justify-center' : 'w-full px-2.5',
        className,
      )}
      {...props}
    >
      <span className="flex size-4 shrink-0 items-center justify-center">{icon}</span>
      <span className={rail ? 'sr-only' : 'truncate'}>{label}</span>
    </a>
  )

  return rail ? (
    <Tooltip content={label} side="right">
      {link}
    </Tooltip>
  ) : (
    link
  )
}

// The company button at the top; its name is cut with an ellipsis and read whole in a tooltip,
// which the rail always shows.
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
    <Tooltip content={name} side={rail ? 'right' : 'bottom'} disabled={!(rail || cut)}>
      {link}
    </Tooltip>
  )
}

// The account button of the sidebar foot (avatar, name and email); the rail and the topbar keep the avatar.
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
    <Tooltip content={name ?? email} side={rail ? 'right' : 'top'} disabled={!(rail || cut)}>
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
