import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { CardList, ListRowLink } from './list-row'

it('a row link renders its leading slot, title and secondary line, and a decorative chevron', () => {
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
  expect(screen.getByText('/c/northwind').getAttribute('aria-hidden')).toBe('true')
  expect(link.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  expect(screen.getByRole('list')).toBeTruthy()
})

it('a row link without a secondary line shows only its title', () => {
  render(<ListRowLink href="/x" title="Sol Bakery" />)

  expect(screen.getByRole('link').textContent).toBe('Sol Bakery')
})
