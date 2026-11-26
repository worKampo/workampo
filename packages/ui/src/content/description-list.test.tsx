import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { DescriptionList } from './description-list'

it('DescriptionList pairs each term with its details and keeps their direction', () => {
  render(<DescriptionList items={[{ term: 'App', details: 'example.com/c/acme', dir: 'ltr' }]} />)

  const details = screen.getByText('example.com/c/acme')

  expect(screen.getByText('App').tagName).toBe('DT')
  expect(details.tagName).toBe('DD')
  expect(details.getAttribute('dir')).toBe('ltr')
})
