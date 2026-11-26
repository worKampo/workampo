import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { CardScreen } from './card-screen'

it('CardScreen puts the logo in a page header and the task in a card under the main landmark', () => {
  render(<CardScreen title="Sign in">form</CardScreen>)

  const main = screen.getByRole('main')

  expect(screen.getByRole('banner').textContent).toContain('worKampo')
  expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeTruthy()
  expect(main.textContent).toContain('form')
})

it('CardScreen focusTitle focuses the h1 without a focus ring, since it is not interactive', () => {
  render(
    <CardScreen title="Error" focusTitle>
      body
    </CardScreen>,
  )

  const heading = screen.getByRole('heading', { level: 1 })
  expect(document.activeElement).toBe(heading)
  expect(heading.className).toMatch(/outline-none/)
})

it('CardScreen without focusTitle keeps the default outline of the h1', () => {
  render(<CardScreen title="Sign in">form</CardScreen>)

  expect(screen.getByRole('heading', { level: 1 }).className).not.toMatch(/outline-none/)
})
