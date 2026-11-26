import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it } from 'vitest'

// A specifier Vite does not resolve ahead, so the file loads before T3 creates the module; turn it
// into a static import when the it.fails marks go.
const MODULE = './banner'
const load = () => import(/* @vite-ignore */ MODULE)

describe('Banner', () => {
  it.fails('@id:companies-166-5 the negative banner is an alert in the negative colours with a decorative icon', async () => {
    const { Banner } = await load()
    render(<Banner variant="negative">We could not create the company.</Banner>)

    const banner = screen.getByRole('alert')
    expect(banner.textContent).toContain('We could not create the company.')
    expect(banner.className).toMatch(/bg-neg-bg/)
    expect(banner.className).toMatch(/border-neg-border/)
    expect(banner.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  it.fails('@id:companies-166-5 the negative banner takes focus by code only, through its ref', async () => {
    const { Banner } = await load()
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
