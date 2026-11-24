import { fireEvent, render } from '@testing-library/react'
import { expect, it } from 'vitest'
import { Avatar } from './avatar'

const avatarOf = (ui: React.ReactElement) => {
  const avatar = render(ui).container.firstElementChild
  if (!avatar) throw new Error('no avatar rendered')
  return avatar
}

it('E1 the shape comes from the kind: a person is round, a company a rounded square', () => {
  const person = avatarOf(<Avatar kind="person" name="Northwind Logistics" />)
  const company = avatarOf(<Avatar kind="company" name="Northwind Logistics" />)

  expect(person.className).toContain('rounded-full')
  expect(company.className).toContain('rounded-lg')
  expect(company.className).not.toContain('rounded-full')
})

it('E2 E4 it shows the initials of the name, or of the email without a name', () => {
  expect(avatarOf(<Avatar kind="person" name="Lucía Ortega" />).textContent).toBe('LO')
  expect(avatarOf(<Avatar kind="person" name="ana@example.com" />).textContent).toBe('A')
})

it('E3 without a letter to show, a generic icon on the neutral colour', () => {
  const avatar = avatarOf(<Avatar kind="person" name="123 !!" />)

  expect(avatar.querySelector('svg')).not.toBeNull()
  expect(avatar.className).toContain('bg-muted')
})

it('E5 the same initials get the same palette colour', () => {
  const first = avatarOf(<Avatar kind="person" name="Lucía Ortega" />)
  const second = avatarOf(<Avatar kind="company" name="Laura Olmo" size="lg" />)
  const colour = (avatar: Element) => avatar.className.match(/bg-avatar-\d-bg/)?.[0]

  expect(colour(first)).toBeDefined()
  expect(colour(second)).toBe(colour(first))
})

it('it is decorative: the name or the button around it carries the meaning', () => {
  expect(avatarOf(<Avatar kind="person" name="Lucía Ortega" />).getAttribute('aria-hidden')).toBe(
    'true',
  )
})

it('E6 an image wins while it loads, and falls back to the initials when it fails', () => {
  const avatar = avatarOf(<Avatar kind="company" name="Northwind Logistics" src="/logo.png" />)

  expect(avatar.tagName).toBe('IMG')
  expect(avatar.getAttribute('alt')).toBe('')
  expect(avatar.className).toContain('rounded-lg')

  fireEvent.error(avatar)

  expect(document.body.textContent).toBe('NL')
})
