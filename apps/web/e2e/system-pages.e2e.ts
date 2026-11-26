import { expect, type Page, test } from '@playwright/test'

// Ticket 93: the root's 404 and 500 in a real browser, from the entry bundle. Not an acceptance
// scenario: it cites no @id (docs/design/components.md, "System page" and "Error reference").

test.use({ locale: 'es-ES' })

// A made-up reference (ADR-0043).
const REFERENCE = '7F3K-92QD'
const NOT_FOUND = { level: 1, name: 'Página no encontrada' } as const
const FAILED = { level: 1, name: 'Algo ha ido mal' } as const
// The web retries a 5xx three times (1 s, 2 s, 4 s) before the route fails.
const AFTER_RETRIES = { timeout: 15_000 }

// Every /api/me answers a 500 problem+json with the reference; returns how many were asked.
async function failMe(page: Page) {
  const asked = { count: 0 }
  await page.route('**/api/me', (route) => {
    asked.count++
    return route.fulfill({
      status: 500,
      contentType: 'application/problem+json',
      body: JSON.stringify({
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
        code: 'api.unexpected',
        reference: REFERENCE,
      }),
    })
  })

  return asked
}

test('SystemPage E1 a path that does not exist shows the 404 with a fixed way home', async ({
  page,
}) => {
  await page.goto('/no-existe')

  await expect(page.getByRole('heading', NOT_FOUND)).toBeVisible()
  await expect(page.getByRole('heading', NOT_FOUND)).toBeFocused()
  await expect(page.getByText('Error 404')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('href', '/')
  await expect(page).toHaveTitle('Página no encontrada · worKampo')
})

test('X1 X2 a hostile path and query are not echoed, and home stays /', async ({ page }) => {
  const dialogs: string[] = []
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message())
    void dialog.dismiss()
  })

  await page.goto(
    '/no-existe/%3Cimg%20src=x%20onerror=alert(1)%3E?q=%3Cscript%3Ealert(1)%3C/script%3E&returnTo=https://evil.example',
  )

  await expect(page.getByRole('heading', NOT_FOUND)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('href', '/')
  const html = await page.locator('body').innerHTML()
  for (const echo of ['no-existe', 'onerror', 'evil.example', '<script']) {
    expect(html).not.toContain(echo)
  }
  expect(dialogs).toEqual([])
})

test('SystemPage E2 a server failure shows the 500 with the reference, which copies', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await failMe(page)

  await page.goto('/')

  await expect(page.getByRole('heading', FAILED)).toBeVisible(AFTER_RETRIES)
  await expect(page).toHaveTitle('Algo ha ido mal · worKampo')
  await expect(page.getByText(`Referencia: ${REFERENCE}`)).toBeVisible()
  const copy = page.getByRole('button', { name: 'Copiar la referencia' })
  await copy.click()
  await expect(page.getByRole('status').filter({ hasText: 'Referencia copiada' })).toHaveCount(1)
  await expect(copy).toBeFocused()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(REFERENCE)
})

test('SystemPage E2 «Reintentar» reloads the page', async ({ page }) => {
  const asked = await failMe(page)
  await page.goto('/')
  await expect(page.getByRole('heading', FAILED)).toBeVisible(AFTER_RETRIES)
  const before = asked.count

  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Reintentar' }).click(),
  ])

  await expect.poll(() => asked.count).toBeGreaterThan(before)
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })

  test('SystemPage E3 the page fills the screen, without the shell, with 44 px controls', async ({
    page,
  }) => {
    await failMe(page)
    await page.goto('/')
    await expect(page.getByRole('heading', FAILED)).toBeVisible(AFTER_RETRIES)

    await expect(page.getByRole('navigation')).toHaveCount(0)
    const { scrollWidth, pageHeight } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      pageHeight:
        document.querySelector('main')?.parentElement?.getBoundingClientRect().height ?? 0,
    }))
    expect(scrollWidth).toBeLessThanOrEqual(375)
    expect(pageHeight).toBeGreaterThanOrEqual(812)
    for (const control of [
      page.getByRole('button', { name: 'Copiar la referencia' }),
      page.getByRole('button', { name: 'Reintentar' }),
      page.getByRole('link', { name: 'Ir al inicio' }),
    ]) {
      const box = await control.boundingBox()
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
    }
  })
})
