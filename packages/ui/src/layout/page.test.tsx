import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { Page } from './page'

it('Page titles its content with an h1 that follows the text direction and wraps long names', () => {
  render(<Page title="Bienvenido a Northwind">content</Page>)

  const title = screen.getByRole('heading', { level: 1, name: 'Bienvenido a Northwind' })

  expect(title.getAttribute('dir')).toBe('auto')
  expect(title.className).toContain('wrap-anywhere')
  expect(title.parentElement?.textContent).toContain('content')
})
