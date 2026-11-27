import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it } from 'vitest'
import { Banner } from './banner'

describe('Banner', () => {
  it('@id:companies-166-5 the negative banner is an alert in the negative colours with a decorative icon', () => {
    render(<Banner variant="negative">We could not create the company.</Banner>)

    const banner = screen.getByRole('alert')
    expect(banner.textContent).toContain('We could not create the company.')
    expect(banner.className).toMatch(/bg-neg-bg/)
    expect(banner.className).toMatch(/border-neg-border/)
    expect(banner.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('@id:companies-166-5 the negative banner takes focus by code only, through its ref', () => {
    const ref = createRef<HTMLDivElement>()
    render(
      <Banner ref={ref} variant="negative">
        We could not create the company.
      </Banner>,
    )

    const banner = screen.getByRole('alert')
    expect(banner.tabIndex).toBe(-1)
    expect(ref.current).toBe(banner)
    ref.current?.focus()
    expect(document.activeElement).toBe(banner)
  })
})

describe('Banner info', () => {
  it('E5 the info banner is a status in the info colours with a decorative icon, and never takes the focus', () => {
    render(<Banner variant="info">A new version is available</Banner>)

    const banner = screen.getByRole('status')
    expect(banner.textContent).toContain('A new version is available')
    expect(banner.className).toMatch(/bg-info-bg/)
    expect(banner.className).toMatch(/border-info-border/)
    expect(banner.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(banner.hasAttribute('tabindex')).toBe(false)
  })

  it('E5 the caller can override the role of the info banner', () => {
    render(
      <Banner variant="info" role="note">
        A new version is available
      </Banner>,
    )

    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByRole('note').className).toMatch(/bg-info-bg/)
  })

  it('E5 floating is fixed, with the float shadow and logical insets only', () => {
    render(
      <Banner variant="info" floating>
        A new version is available
      </Banner>,
    )

    const banner = screen.getByRole('status')
    for (const name of ['fixed', 'shadow-(--shadow-float)', 'mb-safe'])
      expect(banner.className.split(' '), name).toContain(name)
    // Physical sides would not mirror in RTL.
    expect(banner.className).not.toMatch(/(^|\s)(left|right|ml|mr|pl|pr)-/)
  })
})
