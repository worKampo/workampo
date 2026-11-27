import { expect, type Page, test } from '@playwright/test'
import { newEmail, signInWithCode } from '../../../e2e/support/acceptance-support'

// The side menu and the account menu in a real browser, under the CSP of _headers (style-src 'self').
// Not an acceptance scenario: it cites no @id.

test.use({ locale: 'es-ES' })

// Console messages and the securitypolicyviolation events of the current document: Chromium does not
// always log a blocked eval to the console, but it always fires the event.
async function watchCsp(page: Page) {
  const logged: string[] = []
  page.on('console', (message) => {
    if (/Content Security Policy/i.test(message.text())) logged.push(message.text())
  })
  await page.addInitScript(() => {
    const seen: string[] = []
    Object.assign(window, { cspViolations: seen })
    document.addEventListener('securitypolicyviolation', (event) => {
      seen.push(`${event.violatedDirective} ${event.blockedURI}`)
    })
  })

  return async () => [
    ...logged,
    ...(await page.evaluate(
      () => (window as unknown as { cspViolations?: string[] }).cspViolations ?? [],
    )),
  ]
}

// A new account that owns one company and is inside it, on its home.
async function openOwnCompany(page: Page) {
  await signInWithCode(page, newEmail())
  const slug = `e2e-csp-${crypto.randomUUID().slice(0, 8)}`
  const created = await page.request.post('/api/companies', {
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    data: { name: 'Northwind Logistics', slug, defaultLanguage: 'es', userName: 'E2E' },
  })
  expect(created.status()).toBe(201)
  await page.goto(`/c/${slug}`)
  await expect(
    page.getByRole('heading', { name: 'Bienvenido a Northwind Logistics' }),
  ).toBeVisible()
}

// Taller than the window, so the page behind could scroll.
const makePageTall = (page: Page) =>
  page.evaluate(() => {
    const tall = document.createElement('div')
    // The CSSOM is not an inline style for the CSP.
    tall.style.height = '300vh'
    document.getElementById('content')?.appendChild(tall)
  })

// zod probes for eval the first time it validates; under script-src 'self' that probe is a violation.
test('validating a form raises no CSP violation', async ({ page }) => {
  const cspErrors = await watchCsp(page)
  await page.goto('/login')

  await page.getByRole('textbox').fill('not-an-email')
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await expect(page.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')

  expect(await cspErrors()).toEqual([])
})

for (const { name, viewport } of [
  { name: 'a narrow desktop window', viewport: { width: 900, height: 700 } },
  { name: 'a phone', viewport: { width: 375, height: 812 } },
]) {
  test.describe(`on ${name}`, () => {
    test.use({ viewport })

    test('the side menu opens with no CSP error, keeps the focus in and the page behind still', async ({
      page,
    }) => {
      const cspErrors = await watchCsp(page)
      await openOwnCompany(page)
      await makePageTall(page)
      const open = page.getByRole('button', { name: 'Abrir menú' })

      await open.click()

      const menu = page.getByRole('dialog', { name: 'Menú' })
      await expect(menu).toBeVisible()
      await expect(menu.getByRole('link', { name: /Northwind Logistics/ })).toBeFocused()
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe(
        'hidden',
      )
      await page.mouse.move(viewport.width - 20, viewport.height / 2)
      await page.mouse.wheel(0, 600)
      expect(await page.evaluate(() => window.scrollY)).toBe(0)
      for (const key of [...Array(6).fill('Tab'), 'Shift+Tab']) {
        await page.keyboard.press(key)
        const insideOrNone = await page.evaluate(() => {
          const active = document.activeElement
          return !active || active === document.body || active.closest('dialog') !== null
        })
        expect(insideOrNone, key).toBe(true)
      }
      await page.mouse.click(viewport.width - 20, viewport.height / 2)
      await expect(menu).toHaveCount(0)
      await expect(open).toBeFocused()
      await page.mouse.wheel(0, 600)
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
      expect(await cspErrors()).toEqual([])
    })

    test('the account menu opens from the side menu, usable and with no CSP error', async ({
      page,
    }) => {
      test.fail(true, 'the account button is still in the topbar, not in the side menu')
      const cspErrors = await watchCsp(page)
      await openOwnCompany(page)
      await expect(page.getByRole('banner').getByRole('button', { name: /E2E/ })).toHaveCount(0)
      await page.getByRole('button', { name: 'Abrir menú' }).click()
      const menu = page.getByRole('dialog', { name: 'Menú' })
      const account = menu.getByRole('button', { name: /E2E/ })

      await account.click()
      const signOut = page.getByRole('menuitem', { name: 'Cerrar sesión' })
      await expect(signOut).toBeVisible()
      // Outside the modal dialog the item would be inert: the trial click fails its hit test.
      await signOut.click({ trial: true })
      await page.keyboard.press('Escape')

      await expect(page.getByRole('menu')).toHaveCount(0)
      await expect(menu).toBeVisible()
      await expect(account).toBeFocused()
      expect(await cspErrors()).toEqual([])
    })
  })
}
