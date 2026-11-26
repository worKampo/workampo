import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

// A specifier Vite does not resolve ahead, so the file loads before T7 creates the module; turn it
// into a static import when the it.fails marks go.
const MODULE = './app-shell'
const load = () => import(/* @vite-ignore */ MODULE)

const LABELS = {
  skipToContent: 'Saltar al contenido',
  navigation: 'Principal',
  openNav: 'Abrir menú',
  closeNav: 'Cerrar menú',
  navDialog: 'Menú',
  collapse: 'Plegar menú',
  expand: 'Desplegar menú',
}
const LONG_NAME = 'Cooperativa de Transportes y Logística del Noroeste Peninsular, Sociedad Anónima'

// Links stay on the page: jsdom does not navigate.
const stay = (event: { preventDefault: () => void }) => event.preventDefault()

async function renderShell({
  collapsed = false,
  onCollapsedChange = () => {},
  name = 'Northwind Logistics',
}: Partial<{
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  name: string
}> = {}) {
  const { AppShell, CompanyLink, NavItem } = await load()
  const icon = <svg aria-hidden="true" />
  render(
    <AppShell
      labels={LABELS}
      collapsed={collapsed}
      onCollapsedChange={onCollapsedChange}
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
      user={<button type="button">Ana</button>}
    >
      <p>Contenido</p>
    </AppShell>,
  )
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

afterEach(() => vi.restoreAllMocks())

it.fails('@id:companies-92-10 the skip link is the first stop and leads to the main content', async () => {
  await renderShell()

  const [first] = document.querySelectorAll<HTMLElement>('a[href], button')
  const main = screen.getByRole('main')

  expect(first?.textContent).toBe('Saltar al contenido')
  expect(first?.getAttribute('href')).toBe('#content')
  expect(main.id).toBe('content')
  expect(main.getAttribute('tabindex')).toBe('-1')
  expect(main.textContent).toContain('Contenido')
})

it.fails('@id:companies-92-1 the navigation is named and only the current item is marked as such', async () => {
  await renderShell()

  const nav = screen.getByRole('navigation', { name: 'Principal' })

  expect(within(nav).getByRole('link', { name: 'Inicio' }).getAttribute('aria-current')).toBe(
    'page',
  )
  expect(within(nav).getByRole('link', { name: 'Otra' }).getAttribute('aria-current')).toBeNull()
  expect(screen.getByRole('button', { name: 'Ana' })).toBeTruthy()
})

it.fails('@id:companies-92-7 folding asks for the rail, and the rail offers to unfold', async () => {
  const onCollapsedChange = vi.fn()
  await renderShell({ onCollapsedChange })

  fireEvent.click(screen.getByRole('button', { name: 'Plegar menú' }))

  expect(onCollapsedChange).toHaveBeenCalledWith(true)
})

it.fails('@id:companies-92-7 unfolding the rail asks for the sidebar', async () => {
  const onCollapsedChange = vi.fn()
  await renderShell({ collapsed: true, onCollapsedChange })

  fireEvent.click(screen.getByRole('button', { name: 'Desplegar menú' }))

  expect(onCollapsedChange).toHaveBeenCalledWith(false)
})

it.fails('@id:companies-92-7 in the rail each item keeps its name and shows it in a tooltip', async () => {
  await renderShell({ collapsed: true })
  const item = within(screen.getByRole('navigation', { name: 'Principal' })).getByRole('link', {
    name: 'Inicio',
  })

  fireEvent.focus(item)

  expect((await screen.findByRole('tooltip')).textContent).toBe('Inicio')
})

it.fails('@id:companies-92-7 in the open sidebar the items show no tooltip', async () => {
  await renderShell()
  const item = within(screen.getByRole('navigation', { name: 'Principal' })).getByRole('link', {
    name: 'Inicio',
  })

  fireEvent.focus(item)

  expect(screen.queryByRole('tooltip')).toBeNull()
})

it.fails('@id:companies-92-6 the menu button opens a modal side menu with the focus on the company', async () => {
  await renderShell()

  fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }))

  const dialog = await screen.findByRole('dialog', { name: 'Menú' })
  const company = within(dialog).getByRole('link', { name: /Northwind Logistics/ })
  expect(within(dialog).getByRole('link', { name: 'Inicio' })).toBeTruthy()
  await waitFor(() => expect(document.activeElement).toBe(company))
})

it.fails('@id:companies-92-6 the focus stays trapped inside the side menu', async () => {
  await renderShell()
  fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }))
  const dialog = await screen.findByRole('dialog', { name: 'Menú' })
  const stops = dialog.querySelectorAll<HTMLElement>('a[href], button')
  const last = stops[stops.length - 1]
  last?.focus()

  fireEvent.keyDown(last ?? dialog, { key: 'Tab' })

  expect(dialog.contains(document.activeElement)).toBe(true)
})

it.fails('@id:companies-92-6 Esc closes the side menu and the focus goes back to the menu button', async () => {
  await renderShell()
  const open = screen.getByRole('button', { name: 'Abrir menú' })
  fireEvent.click(open)
  const dialog = await screen.findByRole('dialog', { name: 'Menú' })

  fireEvent.keyDown(dialog, { key: 'Escape' })

  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(document.activeElement).toBe(open)
})

it.fails('@id:companies-92-6 the close button and choosing an item close the side menu', async () => {
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

it.fails('@id:companies-92-9 a cut company name shows whole in a tooltip, and its link is named by it', async () => {
  layOutText({ cut: true })
  await renderShell({ name: LONG_NAME })
  const company = companyLink(new RegExp(LONG_NAME))

  fireEvent.focus(company)

  expect((await screen.findByRole('tooltip')).textContent).toBe(LONG_NAME)
})

it.fails('@id:companies-92-9 a company name that fits shows no tooltip', async () => {
  layOutText({ cut: false })
  await renderShell()
  const company = companyLink(/Northwind Logistics/)

  fireEvent.focus(company)

  expect(screen.queryByRole('tooltip')).toBeNull()
})

it.fails('@id:companies-92-1 the company link carries the name in its own direction and the role', async () => {
  await renderShell({ name: 'شركة الشمال' })
  const company = companyLink(/شركة الشمال/)

  expect(company.getAttribute('href')).toBe('/companies')
  expect(company.textContent).toContain('Propietario')
  expect(within(company).getByText('شركة الشمال').getAttribute('dir')).toBe('auto')
})
