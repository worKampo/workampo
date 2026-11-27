import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, onTestFinished, vi } from 'vitest'

import {
  Menu,
  MenuContent,
  MenuHeader,
  MenuItem,
  MenuScope,
  MenuSeparator,
  MenuTrigger,
} from './menu'

async function renderAccountMenu({ onSignOut = () => {}, busy = false } = {}) {
  render(
    <Menu>
      <MenuTrigger aria-label="Cuenta: Ana">Ana</MenuTrigger>
      <MenuContent>
        <MenuHeader>Ana · ana@example.com</MenuHeader>
        <MenuSeparator />
        <MenuItem onSelect={onSignOut}>Profile</MenuItem>
        <MenuItem onSelect={onSignOut} busy={busy}>
          Cerrar sesión
        </MenuItem>
      </MenuContent>
    </Menu>,
  )

  return screen.getByRole('button', { name: 'Cuenta: Ana' })
}

it('@id:companies-92-5 Enter opens the menu on its first item and Esc closes it back on the trigger', async () => {
  const trigger = await renderAccountMenu()
  trigger.focus()

  fireEvent.keyDown(trigger, { key: 'Enter' })

  const menu = await screen.findByRole('menu')
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Profile' })),
  )
  fireEvent.keyDown(menu, { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  expect(document.activeElement).toBe(trigger)
})

it('@id:companies-92-5 ArrowUp opens the menu on its last item', async () => {
  const trigger = await renderAccountMenu()
  trigger.focus()

  fireEvent.keyDown(trigger, { key: 'ArrowUp' })

  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Cerrar sesión' })),
  )
})

it('@id:companies-92-5 the header is not an item and the separator divides it from the items', async () => {
  const trigger = await renderAccountMenu()

  fireEvent.keyDown(trigger, { key: 'Enter' })

  await screen.findByRole('menu')
  expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
    'Profile',
    'Cerrar sesión',
  ])
  expect(screen.getByText('Ana · ana@example.com')).toBeTruthy()
  expect(screen.getByRole('separator')).toBeTruthy()
})

it('@id:companies-92-5 a busy item is aria-disabled, keeps the menu open and does not run again', async () => {
  const onSignOut = vi.fn()
  const trigger = await renderAccountMenu({ onSignOut, busy: true })
  fireEvent.keyDown(trigger, { key: 'Enter' })
  const item = await screen.findByRole('menuitem', { name: 'Cerrar sesión' })

  fireEvent.click(item)

  expect(item.getAttribute('aria-disabled')).toBe('true')
  expect(onSignOut).not.toHaveBeenCalled()
  expect(screen.getByRole('menu')).toBeTruthy()
})

it('@id:companies-92-5 the menu does not lock the page behind, and a press outside closes it', async () => {
  const trigger = await renderAccountMenu()
  fireEvent.keyDown(trigger, { key: 'Enter' })
  await screen.findByRole('menu')

  expect(document.body.hasAttribute('data-scroll-locked')).toBe(false)
  expect(document.body.style.pointerEvents).toBe('')
  fireEvent.pointerDown(document.body)

  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
})

// showModal makes everything outside the side menu's <dialog> inert, a menu portalled to body included.
it('@id:companies-196-2 inside the side menu of the shell the content is portalled into its dialog', async () => {
  const dialog = document.body.appendChild(document.createElement('dialog'))
  dialog.open = true
  onTestFinished(() => dialog.remove())
  render(
    <MenuScope container={dialog}>
      <Menu>
        <MenuTrigger>Ana</MenuTrigger>
        <MenuContent>
          <MenuItem>Cerrar sesión</MenuItem>
        </MenuContent>
      </Menu>
    </MenuScope>,
  )

  fireEvent.keyDown(screen.getByRole('button', { name: 'Ana' }), { key: 'Enter' })

  expect(dialog.contains(await screen.findByRole('menu'))).toBe(true)
})

it('@id:companies-196-1 the shell learns when a menu inside it opens and closes', async () => {
  const onOpenChange = vi.fn()
  render(
    <MenuScope onOpenChange={onOpenChange}>
      <Menu>
        <MenuTrigger>Ana</MenuTrigger>
        <MenuContent>
          <MenuItem>Cerrar sesión</MenuItem>
        </MenuContent>
      </Menu>
    </MenuScope>,
  )

  fireEvent.keyDown(screen.getByRole('button', { name: 'Ana' }), { key: 'Enter' })
  fireEvent.keyDown(await screen.findByRole('menu'), { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())

  expect(onOpenChange.mock.calls).toEqual([[true], [false]])
})
