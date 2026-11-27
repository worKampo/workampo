import { expect, type Page, test } from '@playwright/test'
import { newEmail, signInWithCode } from '../../../e2e/support/acceptance-support'

// How the company shell lays out in a real browser: what jsdom cannot compute (boxes, styles, media
// queries). Not an acceptance scenario: it cites no @id.

test.use({ locale: 'es-ES' })

const SIDEBAR_KEY = 'workampo:sidebar'

// A new account that owns one company and is inside it, on its home.
async function openOwnCompany(page: Page, { folded = false } = {}) {
  await signInWithCode(page, newEmail())
  const slug = `e2e-shell-${crypto.randomUUID().slice(0, 8)}`
  const created = await page.request.post('/api/companies', {
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    data: { name: 'Northwind Logistics', slug, defaultLanguage: 'es', userName: 'E2E' },
  })
  expect(created.status()).toBe(201)
  if (folded) await page.evaluate((key) => localStorage.setItem(key, 'rail'), SIDEBAR_KEY)
  await page.goto(`/c/${slug}`)
  await expect(
    page.getByRole('heading', { name: 'Bienvenido a Northwind Logistics' }),
  ).toBeVisible()
}

// The colour an element shows: its own background or, if transparent, the nearest painted ancestor's.
const paintedBackground = (element: Element) => {
  for (let node: Element | null = element; node; node = node.parentElement) {
    const color = getComputedStyle(node).backgroundColor
    if (color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') return color
  }
  return getComputedStyle(document.documentElement).backgroundColor
}

test('on a short window the company and the user stay in view and the middle scrolls', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 320 })
  await openOwnCompany(page)
  const sidebar = page.getByRole('complementary')

  const company = await sidebar.getByRole('link', { name: /Northwind Logistics/ }).boundingBox()
  const user = await sidebar.getByRole('button', { name: /E2E/ }).boundingBox()

  expect(company?.y).toBeLessThan(24)
  expect(user && user.y + user.height).toBeLessThanOrEqual(320)
  const scrolls = await sidebar.getByRole('navigation').evaluate((nav) => {
    const aside = nav.closest('aside')
    for (let node: Element | null = nav; node && node !== aside; node = node.parentElement)
      if (getComputedStyle(node).overflowY === 'auto') return true
    return false
  })
  expect(scrolls).toBe(true)
})

test('the viewport covers the safe areas', async ({ page }) => {
  await page.goto('/login')

  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    'content',
    /viewport-fit=cover/,
  )
})

for (const colorScheme of ['light', 'dark'] as const) {
  test(`in ${colorScheme} the page and the sidebar share one background`, async ({ page }) => {
    await page.emulateMedia({ colorScheme })
    await openOwnCompany(page)

    const main = await page.getByRole('main').evaluate(paintedBackground)
    const sidebar = await page.getByRole('complementary').evaluate(paintedBackground)

    expect(main).toBe(sidebar)
  })
}

test('the current item is marked by its tint, weight and aria-current, with no shadow', async ({
  page,
}) => {
  await openOwnCompany(page)

  const home = page.getByRole('navigation').getByRole('link', { name: 'Inicio' })

  await expect(home).toHaveAttribute('aria-current', 'page')
  await expect(home).toHaveCSS('font-weight', '600')
  await expect(home).toHaveCSS('box-shadow', 'none')
})

test('with reduced motion the rail floats with no transition', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openOwnCompany(page, { folded: true })

  await page.getByRole('navigation').hover()
  const pin = page.getByRole('button', { name: 'Fijar menú lateral' })
  await expect(pin).toBeVisible()

  // Whatever element carries the floating panel, from the button up to the aside, moves no time.
  const durations = await pin.evaluate((button) => {
    const aside = button.closest('aside')
    const found: string[] = []
    for (let node: Element | null = button; node; node = node.parentElement) {
      found.push(getComputedStyle(node).transitionDuration)
      if (node === aside) break
    }
    return found.flatMap((duration) => duration.split(',').map((part) => part.trim()))
  })
  expect(durations.filter((duration) => duration !== '0s')).toEqual([])
})

test.describe('on a desktop-wide touch screen', () => {
  test.use({ viewport: { width: 1194, height: 834 }, hasTouch: true, isMobile: true })

  test('«Desplegar menú lateral» sits under the company and floats the rail', async ({ page }) => {
    await openOwnCompany(page, { folded: true })
    expect(await page.evaluate(() => matchMedia('(hover: none)').matches)).toBe(true)

    const expand = page.getByRole('button', { name: 'Desplegar menú lateral' })
    await expect(expand).toBeVisible()
    const company = await page.getByRole('link', { name: /Northwind Logistics/ }).boundingBox()
    const button = await expand.boundingBox()
    expect(company && button && button.y >= company.y + company.height).toBe(true)
    await expand.tap()

    await expect(page.getByRole('button', { name: 'Fijar menú lateral' })).toBeVisible()
  })
})
