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
