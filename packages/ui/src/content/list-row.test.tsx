import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { CardList, ListRowLink } from './list-row'

it('a row link is named by its title, described by its secondary line, with a decorative chevron', () => {
  render(
    <CardList>
      <li>
        <ListRowLink
          href="/c/northwind"
          leading={<span data-testid="leading" />}
          title="Northwind Logistics"
          subtitle="/c/northwind"
        />
      </li>
    </CardList>,
  )

  const link = screen.getByRole('link', { name: 'Northwind Logistics' })
  expect(link.getAttribute('href')).toBe('/c/northwind')
  expect(screen.getByTestId('leading')).toBeTruthy()
  expect(link.getAttribute('aria-describedby')).toBe(screen.getByText('/c/northwind').id)
  expect(link.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  expect(screen.getByRole('list')).toBeTruthy()
})

it('a row link without a secondary line shows only its title', () => {
  render(<ListRowLink href="/x" title="Sol Bakery" />)

  expect(screen.getByRole('link').textContent).toBe('Sol Bakery')
})
