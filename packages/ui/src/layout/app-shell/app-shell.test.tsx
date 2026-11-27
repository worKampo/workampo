import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { type ReactNode, useState } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '../../overlays/menu'
import { AppShell, CompanyLink, NavItem, TopbarCompany, UserButton } from './app-shell'

const LABELS = {
  skipToContent: 'Saltar al contenido',
  navigation: 'Principal',
  openNav: 'Abrir menú',
  closeNav: 'Cerrar menú',
  navDialog: 'Menú',
  collapse: 'Plegar menú lateral',
  expand: 'Desplegar menú lateral',
  pin: 'Fijar menú lateral',
}
const LONG_NAME = 'Cooperativa de Transportes y Logística del Noroeste Peninsular, Sociedad Anónima'
// The rail's hover delay, in ms.
const DELAY = 300

// Links stay on the page: jsdom does not navigate.
const stay = (event: { preventDefault: () => void }) => event.preventDefault()

type Options = Partial<{
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  name: string
  user: ReactNode
  topbar: ReactNode
  search: ReactNode
  notifications: ReactNode
}>

// Owns `collapsed` like the page does, so pinning and folding change what the shell shows.
function Shell({
  collapsed: initial = false,
  onCollapsedChange = () => {},
  name = 'Northwind Logistics',
  user = <button type="button">Ana</button>,
  topbar,
  search,
  notifications,
}: Options) {
  const [collapsed, setCollapsed] = useState(initial)
  const icon = <svg aria-hidden="true" />

  return (
    <AppShell
      labels={LABELS}
      collapsed={collapsed}
      onCollapsedChange={(next) => {
        onCollapsedChange(next)
        setCollapsed(next)
      }}
      company={
        <CompanyLink
          href="/companies"
          onClick={stay}
          avatar={<span aria-hidden="true">NL</span>}
          name={name}
          meta="Propietario"
        />
      }
      nav={
        <>
          <NavItem href="/c/northwind" onClick={stay} icon={icon} label="Inicio" current />
          <NavItem href="/c/northwind/x" onClick={stay} icon={icon} label="Otra" />
        </>
      }
      user={user}
      topbar={topbar}
      search={search}
      notifications={notifications}
    >
      <p>Contenido</p>
    </AppShell>
  )
}

async function renderShell(options: Options = {}) {
  return render(<Shell {...options} />)
}

// jsdom lays nothing out: a text is "cut" when its box is narrower than its content.
function layOutText({ cut }: { cut: boolean }) {
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(cut ? 400 : 100)
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(200)
}

// The sidebar's company link; the closed side menu holds no other.
function companyLink(name: RegExp) {
  const [link] = screen.getAllByRole('link', { name })
  if (!link) throw new Error(`no link named ${name}`)
  return link
}

const rail = () => screen.getByRole('complementary')
// Floating, the rail shows «Fijar» in the company row; folded, it does not.
const floating = () => screen.queryByRole('button', { name: LABELS.pin }) !== null
const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms))

// A browser's Tab: the key goes down where the focus is, then the focus moves.
function tabTo(element: HTMLElement) {
  fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Tab' })
  act(() => element.focus())
}

// A browser's mouse click: the pointer goes down before the focus moves.
function clickWithMouse(element: HTMLElement) {
  fireEvent.pointerDown(element, { pointerType: 'mouse', button: 0 })
  fireEvent.mouseDown(element)
  act(() => element.focus())
  fireEvent.pointerUp(element, { pointerType: 'mouse', button: 0 })
  fireEvent.mouseUp(element)
  fireEvent.click(element)
}

const precedes = (a: Node, b: Node) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

function accountMenu() {
  return (
    <Menu>
      <MenuTrigger asChild>
        <button type="button">Ana</button>
      </MenuTrigger>
      <MenuContent aria-label="Cuenta">
        <MenuItem>Cerrar sesión</MenuItem>
      </MenuContent>
    </Menu>
  )
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

it('@id:companies-92-10 the skip link is the first stop and leads to the main content', async () => {
  await renderShell()

  const [first] = document.querySelectorAll<HTMLElement>('a[href], button')
  const main = screen.getByRole('main')

  expect(first?.textContent).toBe('Saltar al contenido')
  expect(first?.getAttribute('href')).toBe('#content')
  expect(main.id).toBe('content')
  expect(main.getAttribute('tabindex')).toBe('-1')
  expect(main.textContent).toContain('Contenido')
})

it('@id:companies-92-1 the navigation is named and only the current item is marked as such', async () => {
  await renderShell()

  const nav = screen.getByRole('navigation', { name: 'Principal' })

  expect(within(nav).getByRole('link', { name: 'Inicio' }).getAttribute('aria-current')).toBe(
    'page',
  )
  expect(within(nav).getByRole('link', { name: 'Otra' }).getAttribute('aria-current')).toBeNull()
  expect(screen.getByRole('button', { name: 'Ana' })).toBeTruthy()
})

it('@id:companies-92-1 the current item is marked with no ring and no shadow', async () => {
  await renderShell()

  const current = within(screen.getByRole('navigation')).getByRole('link', { name: 'Inicio' })

  expect(current.className).not.toMatch(/(^|\s)(ring|shadow)(-|\s|$)/)
})

it('@id:companies-92-1 the current item takes the text colour, not the muted one', async () => {
  await renderShell()

  const classes = within(screen.getByRole('navigation'))
    .getByRole('link', { name: 'Inicio' })
    .className.split(/\s+/)

  expect(classes).toContain('text-text')
  expect(classes).not.toContain('text-text-1')
})

it('@id:companies-92-7 folding asks for the rail', async () => {
  const onCollapsedChange = vi.fn()
  await renderShell({ onCollapsedChange })

  fireEvent.click(screen.getByRole('button', { name: LABELS.collapse }))

  expect(onCollapsedChange).toHaveBeenCalledWith(true)
})

it('@id:companies-92-7 in the rail the items show no tooltip', async () => {
  await renderShell({ collapsed: true })
  const item = within(screen.getByRole('navigation', { name: 'Principal' })).getByRole('link', {
    name: 'Inicio',
  })

  fireEvent.focus(item)
  await act(async () => {})

  expect(screen.queryByRole('tooltip')).toBeNull()
})

it('@id:companies-92-7 in the rail the company link shows no tooltip', async () => {
  await renderShell({ collapsed: true })

  fireEvent.focus(companyLink(/Northwind Logistics/))
  await act(async () => {})

  expect(screen.queryByRole('tooltip')).toBeNull()
})

it('@id:companies-92-7 in the rail the user button shows no tooltip', async () => {
  await renderShell({
    collapsed: true,
    user: <UserButton avatar={null} name={undefined} email="ana@northwind.test" />,
  })

  fireEvent.focus(screen.getByRole('button', { name: 'ana@northwind.test' }))
  await act(async () => {})

  expect(screen.queryByRole('tooltip')).toBeNull()
})

it('@id:companies-92-7 in the open sidebar the items show no tooltip', async () => {
  await renderShell()
  const item = within(screen.getByRole('navigation', { name: 'Principal' })).getByRole('link', {
    name: 'Inicio',
  })

  fireEvent.focus(item)

  expect(screen.queryByRole('tooltip')).toBeNull()
})

it('@id:companies-196-1 a mouse resting 300 ms on the rail floats it with «Fijar», and leaving folds it 300 ms later', async () => {
  vi.useFakeTimers()
  const onCollapsedChange = vi.fn()
  await renderShell({ collapsed: true, onCollapsedChange })

  fireEvent.pointerEnter(rail(), { pointerType: 'mouse' })
  wait(DELAY - 1)
  expect(floating()).toBe(false)
  wait(1)
  expect(floating()).toBe(true)
  fireEvent.pointerLeave(rail(), { pointerType: 'mouse' })
  wait(DELAY - 1)
  expect(floating()).toBe(true)
  wait(1)

  expect(floating()).toBe(false)
  expect(onCollapsedChange).not.toHaveBeenCalled()
})

it('@id:companies-196-1 a touch on the rail never floats it', async () => {
  vi.useFakeTimers()
  await renderShell({ collapsed: true })

  fireEvent.pointerEnter(rail(), { pointerType: 'touch' })
  wait(DELAY * 3)

  expect(floating()).toBe(false)
})

it('@id:companies-196-1 «Fijar» pins the floating rail, and leaving it then folds nothing', async () => {
  vi.useFakeTimers()
  const onCollapsedChange = vi.fn()
  await renderShell({ collapsed: true, onCollapsedChange })
  fireEvent.pointerEnter(rail(), { pointerType: 'mouse' })
  wait(DELAY)

  fireEvent.click(screen.getByRole('button', { name: LABELS.pin }))
  fireEvent.pointerLeave(rail(), { pointerType: 'mouse' })
  wait(DELAY * 3)

  expect(onCollapsedChange.mock.calls).toEqual([[false]])
  expect(screen.getByRole('button', { name: LABELS.collapse })).toBeTruthy()
  expect(floating()).toBe(false)
})

it('@id:companies-196-1 the keyboard focus entering the rail floats it at once, and leaving it folds it', async () => {
  await renderShell({ collapsed: true })

  tabTo(companyLink(/Northwind Logistics/))
  expect(floating()).toBe(true)
  tabTo(screen.getByRole('main'))

  expect(floating()).toBe(false)
})

it('@id:companies-196-1 Esc folds the rail, which stays folded while the focus stays in it', async () => {
  await renderShell({ collapsed: true })
  tabTo(companyLink(/Northwind Logistics/))
  expect(floating()).toBe(true)

  fireEvent.keyDown(companyLink(/Northwind Logistics/), { key: 'Escape' })
  expect(floating()).toBe(false)
  tabTo(within(screen.getByRole('navigation')).getByRole('link', { name: 'Inicio' }))
  expect(floating()).toBe(false)
  tabTo(screen.getByRole('main'))
  tabTo(companyLink(/Northwind Logistics/))

  expect(floating()).toBe(true)
})

it('@id:companies-196-1 a mouse click on «Plegar» keeps the focus on the button, yet the rail folds 300 ms after the mouse leaves', async () => {
  vi.useFakeTimers()
  const onCollapsedChange = vi.fn()
  await renderShell({ onCollapsedChange })
  fireEvent.pointerEnter(rail(), { pointerType: 'mouse' })

  clickWithMouse(screen.getByRole('button', { name: LABELS.collapse }))
  expect(onCollapsedChange).toHaveBeenCalledWith(true)
  // The mouse is still on the rail: it floats, and the same button now offers to pin.
  expect(document.activeElement).toBe(screen.getByRole('button', { name: LABELS.pin }))
  fireEvent.pointerLeave(rail(), { pointerType: 'mouse' })
  wait(DELAY)

  expect(floating()).toBe(false)
})

it('@id:companies-196-1 a menu open inside the rail keeps it floating, and closing it with a click folds it', async () => {
  vi.useFakeTimers()
  await renderShell({ collapsed: true, user: accountMenu() })
  fireEvent.pointerEnter(rail(), { pointerType: 'mouse' })
  wait(DELAY)

  fireEvent.pointerDown(screen.getByRole('button', { name: 'Ana' }), {
    pointerType: 'mouse',
    button: 0,
  })
  expect(screen.getByRole('menu')).toBeTruthy()
  fireEvent.pointerLeave(rail(), { pointerType: 'mouse' })
  wait(DELAY * 3)
  expect(floating()).toBe(true)
  fireEvent.pointerDown(document.body, { pointerType: 'mouse', button: 0 })
  wait(DELAY)

  expect(screen.queryByRole('menu')).toBeNull()
  expect(floating()).toBe(false)
})

it('@id:companies-196-1 Esc with the account menu open closes only the menu, and a second Esc folds the rail', async () => {
  await renderShell({ collapsed: true, user: accountMenu() })
  const account = screen.getByRole('button', { name: 'Ana' })
  tabTo(account)
  fireEvent.keyDown(account, { key: 'Enter' })
  const menu = await screen.findByRole('menu')

  fireEvent.keyDown(menu, { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  expect(floating()).toBe(true)
  fireEvent.keyDown(document.activeElement ?? account, { key: 'Escape' })

  expect(floating()).toBe(false)
})

it('@id:companies-196-1 leaving the page with the rail about to float raises nothing', async () => {
  vi.useFakeTimers()
  const errors = vi.spyOn(console, 'error')
  const { unmount } = await renderShell({ collapsed: true })
  fireEvent.pointerEnter(rail(), { pointerType: 'mouse' })

  unmount()
  wait(DELAY * 3)

  expect(errors).not.toHaveBeenCalled()
})

it('@id:companies-196-1 on a touch screen «Desplegar» sits under the company and floats the rail, without pinning it', async () => {
  const onCollapsedChange = vi.fn()
  await renderShell({ collapsed: true, onCollapsedChange })
  const expand = within(rail()).getByRole('button', { name: LABELS.expand })
  expect(precedes(companyLink(/Northwind Logistics/), expand)).toBe(true)
  expect(precedes(expand, screen.getByRole('navigation'))).toBe(true)

  fireEvent.click(expand)

  expect(floating()).toBe(true)
  expect(onCollapsedChange).not.toHaveBeenCalled()
})

for (const [pointerType, folds] of [
  ['touch', true],
  ['mouse', false],
] as const) {
  it(`@id:companies-196-1 choosing an item with ${pointerType} in the rail «Desplegar» opened ${folds ? 'folds' : 'keeps'} it`, async () => {
    await renderShell({ collapsed: true })
    const tap = (element: HTMLElement) => {
      fireEvent.pointerDown(element, { pointerType })
      fireEvent.click(element)
    }

    tap(within(rail()).getByRole('button', { name: LABELS.expand }))
    tap(within(rail()).getByRole('link', { name: 'Otra' }))

    expect(floating()).toBe(!folds)
  })
}

it('@id:companies-196-2 the side menu holds the search and ends with the user, with no notifications', async () => {
  await renderShell({
    search: <button type="button">Buscar</button>,
    notifications: <button type="button">Notificaciones</button>,
  })

  fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }))

  const dialog = await screen.findByRole('dialog', { name: 'Menú' })
  expect(within(dialog).getByRole('button', { name: 'Buscar' })).toBeTruthy()
  expect(within(dialog).queryByRole('button', { name: 'Notificaciones' })).toBeNull()
  const stops = [...dialog.querySelectorAll<HTMLElement>('a[href], button')]
  expect(stops.at(-1)?.textContent).toBe('Ana')
  expect(precedes(within(dialog).getByRole('navigation'), stops.at(-1) as HTMLElement)).toBe(true)
})

it('@id:companies-196-2 the topbar holds the company and then the notifications, with no account button', async () => {
  await renderShell({
    topbar: <TopbarCompany avatar={null} name="Northwind Logistics" />,
    notifications: <button type="button">Notificaciones</button>,
  })

  const topbar = screen.getByRole('banner')
  const bell = within(topbar).getByRole('button', { name: 'Notificaciones' })

  expect(precedes(within(topbar).getByText('Northwind Logistics'), bell)).toBe(true)
  expect(within(topbar).queryByRole('button', { name: 'Ana' })).toBeNull()
})

it('@id:companies-196-2 a folded rail does not reach the side menu', async () => {
  await renderShell({ collapsed: true })

  fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }))

  const dialog = await screen.findByRole('dialog', { name: 'Menú' })
  expect(within(dialog).getByText('Inicio').className).not.toContain('sr-only')
  expect(within(dialog).queryByRole('button', { name: LABELS.pin })).toBeNull()
  expect(within(dialog).queryByRole('button', { name: LABELS.expand })).toBeNull()
})

it('@id:companies-196-3 the sidebar reads company, collapse, search, notifications, navigation and user', async () => {
  await renderShell({
    search: <button type="button">Buscar</button>,
    notifications: <button type="button">Notificaciones</button>,
  })
  const sidebar = within(rail())

  const order = [
    sidebar.getByRole('link', { name: /Northwind Logistics/ }),
    sidebar.getByRole('button', { name: LABELS.collapse }),
    sidebar.getByRole('button', { name: 'Buscar' }),
    sidebar.getByRole('button', { name: 'Notificaciones' }),
    sidebar.getByRole('navigation'),
    sidebar.getByRole('button', { name: 'Ana' }),
  ]

  for (const [i, element] of order.slice(1).entries())
    expect(precedes(order[i] as HTMLElement, element), element.textContent ?? '').toBe(true)
})

it('@id:companies-92-6 the menu button opens a modal side menu with the focus on the company', async () => {
  await renderShell()

  fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }))

  const dialog = await screen.findByRole('dialog', { name: 'Menú' })
  const company = within(dialog).getByRole('link', { name: /Northwind Logistics/ })
  expect(within(dialog).getByRole('link', { name: 'Inicio' })).toBeTruthy()
  await waitFor(() => expect(document.activeElement).toBe(company))
})

// The page behind is inert through showModal, which jsdom lacks: csp-overlays.e2e.ts proves the trap.
it('@id:companies-92-6 the side menu is a modal dialog, which keeps the focus inside', async () => {
  const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal')
  await renderShell()

  fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }))

  const dialog = await screen.findByRole('dialog', { name: 'Menú' })
  expect(showModal).toHaveBeenCalledOnce()
  expect(showModal.mock.contexts[0]).toBe(dialog)
})

it('@id:companies-92-6 Esc closes the side menu and the focus goes back to the menu button', async () => {
  await renderShell()
  const open = screen.getByRole('button', { name: 'Abrir menú' })
  fireEvent.click(open)
  const dialog = await screen.findByRole('dialog', { name: 'Menú' })

  // The browser turns Esc into the dialog's cancel event; jsdom does not.
  fireEvent(dialog, new Event('cancel', { cancelable: true }))

  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(document.activeElement).toBe(open)
})

it('@id:companies-92-6 a click on the scrim closes the side menu, a click on the panel does not', async () => {
  await renderShell()
  fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }))
  const dialog = await screen.findByRole('dialog', { name: 'Menú' })

  fireEvent.click(within(dialog).getByRole('navigation'))
  expect(screen.getByRole('dialog')).toBe(dialog)
  // A click on the backdrop reaches the dialog element itself.
  fireEvent.click(dialog)

  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

it('@id:companies-92-6 the close button and choosing an item close the side menu', async () => {
  await renderShell()
  const open = screen.getByRole('button', { name: 'Abrir menú' })

  fireEvent.click(open)
  fireEvent.click(
    within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cerrar menú' }),
  )
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  fireEvent.click(open)
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('link', { name: 'Inicio' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

it('@id:companies-92-9 a cut company name shows whole in a tooltip, and its link is named by it', async () => {
  layOutText({ cut: true })
  await renderShell({ name: LONG_NAME })
  const company = companyLink(new RegExp(LONG_NAME))

  fireEvent.focus(company)

  expect((await screen.findByRole('tooltip')).textContent).toBe(LONG_NAME)
})

it('@id:companies-92-9 a company name that fits shows no tooltip', async () => {
  layOutText({ cut: false })
  await renderShell()
  const company = companyLink(/Northwind Logistics/)

  fireEvent.focus(company)

  expect(screen.queryByRole('tooltip')).toBeNull()
})

it('@id:companies-92-1 the company link carries the name in its own direction and the role', async () => {
  await renderShell({ name: 'شركة الشمال' })
  const company = companyLink(/شركة الشمال/)

  expect(company.getAttribute('href')).toBe('/companies')
  expect(company.textContent).toContain('Propietario')
  expect(within(company).getByText('شركة الشمال').getAttribute('dir')).toBe('auto')
})

it('@id:companies-92-9 in the open sidebar the user button shows a tooltip only when its name is cut', async () => {
  layOutText({ cut: false })
  await renderShell({ user: <UserButton avatar={null} name="Ana" email="ana@northwind.test" /> })
  fireEvent.focus(screen.getByRole('button', { name: /Ana/ }))
  expect(screen.queryByRole('tooltip')).toBeNull()
})

it('@id:companies-92-9 a cut user name shows whole in a tooltip', async () => {
  layOutText({ cut: true })
  await renderShell({
    user: <UserButton avatar={null} name={LONG_NAME} email="ana@northwind.test" />,
  })

  fireEvent.focus(screen.getByRole('button', { name: new RegExp(LONG_NAME) }))

  expect((await screen.findByRole('tooltip')).textContent).toBe(LONG_NAME)
})
