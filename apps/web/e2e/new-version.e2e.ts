import { expect, type Page, type Response, test } from '@playwright/test'
import { signInWithCode } from '../../../e2e/support/acceptance-support'

// Ticket 95: a new version of the web client in a real browser (docs/design/patterns.md, "New
// version available"). Not an acceptance scenario: it cites no @id. The served version changes
// only inside the test, by rewriting the API's answers; no server switch exists for it.

test.use({ locale: 'es-ES' })

// Seed (packages/db/seed): linked@example.com is in Clínica Norte, Northwind and Sol Bakery.
const IN_THREE = 'linked@example.com'
// Made-up hash and date (ADR-0043).
const NEW = '9f8e7d6c5b4a'
const LATER = '2100-01-01T00:00:00Z'
const HASH = /^[0-9a-f]{12}$/
const NOTICE = 'Hay una versión nueva'
const DIALOG = { name: 'Recarga para continuar' } as const
const FAILED = { level: 1, name: 'Algo ha ido mal' } as const

// An answer still in flight when a test ends would fail the next test of the worker.
test.afterEach(({ page }) => page.unrouteAll({ behavior: 'ignoreErrors' }))

// Every API answer with the headers `added` gives at that moment.
async function rewriteApi(page: Page, added: () => Record<string, string>) {
  await page.route('**/api/**', async (route) => {
    const response = await route.fetch()

    return route.fulfill({ response, headers: { ...response.headers(), ...added() } })
  })
}

// Full page loads of the main frame from now on; an SPA navigation loads no document.
function countDocumentLoads(page: Page) {
  const loads = { count: 0 }
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) loads.count++
  })

  return loads
}

// A mark in this document only: a full load drops it, an SPA navigation keeps it.
const markDocument = (page: Page) =>
  page.evaluate(() => {
    ;(window as { e2eDocument?: boolean }).e2eDocument = true
  })
const isSameDocument = (page: Page) =>
  page.evaluate(() => (window as { e2eDocument?: boolean }).e2eDocument === true)

// R10: the CSP of _headers must not block anything the prompts render.
function cspErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error' && /Content Security Policy/i.test(message.text()))
      errors.push(message.text())
  })

  return errors
}

// The company picker's lazy chunk, whatever its hash.
const PICKER_CHUNK = '**/assets/company-picker.page-*.js'

const isApi = (response: Response) => new URL(response.url()).pathname.startsWith('/api/')

test('E1 R10 with a new version the next navigation reloads at its destination, once', async ({
  page,
}) => {
  const csp = cspErrors(page)
  await signInWithCode(page, IN_THREE)
  await expect(page).toHaveURL(/\/companies$/)
  let isRewriting = true
  await rewriteApi(page, () => (isRewriting ? { 'X-App-Version': NEW } : {}))
  const loads = countDocumentLoads(page)
  // The reloaded document is the new version: from then on the API serves what it already says.
  page.on('request', (request) => {
    if (request.isNavigationRequest()) isRewriting = false
  })
  await markDocument(page)

  // An SPA navigation whose answers bring the new version; nothing reloads yet. A click without
  // hovering: a hover preloads the screen, and that answer would already make this navigation reload.
  await page
    .getByRole('link', { name: /Northwind/ })
    .first()
    .dispatchEvent('click')
  await expect(page).toHaveURL(/\/c\/northwind\/?$/)
  // The URL changes before the shell renders; until then the picker's own link is the first one.
  await expect(
    page.getByRole('heading', { level: 1, name: /^Bienvenido a Northwind/ }),
  ).toBeVisible()
  expect(await isSameDocument(page)).toBe(true)
  expect(loads.count).toBe(0)

  // The next navigation is a full load of its destination.
  await page
    .getByRole('link', { name: /Northwind/ })
    .first()
    .click()
  await expect(page).toHaveURL(/\/companies$/)
  await expect.poll(() => loads.count).toBe(1)
  expect(await isSameDocument(page)).toBe(false)

  // Back on the served version: the next navigation is an SPA one again.
  await markDocument(page)
  await page
    .getByRole('link', { name: /Northwind/ })
    .first()
    .click()
  await expect(page).toHaveURL(/\/c\/northwind\/?$/)
  expect(await isSameDocument(page)).toBe(true)
  expect(loads.count).toBe(1)
  expect(csp).toEqual([])
})

test('E2 E7 every call carries my build version, the API serves the same one, and navigating stays in the page', async ({
  page,
}) => {
  const pairs: { sent: string | null; served: string | null }[] = []
  page.on('response', (response) => {
    if (!isApi(response)) return
    pairs.push({
      sent: response.request().headers()['x-client-version'] ?? null,
      served: response.headers()['x-app-version'] ?? null,
    })
  })
  await signInWithCode(page, IN_THREE)
  await expect(page).toHaveURL(/\/companies$/)
  const loads = countDocumentLoads(page)
  await markDocument(page)

  await page
    .getByRole('link', { name: /Northwind/ })
    .first()
    .click()

  await expect(page).toHaveURL(/\/c\/northwind\/?$/)
  expect(await isSameDocument(page)).toBe(true)
  expect(loads.count).toBe(0)
  expect(pairs.length).toBeGreaterThan(0)
  for (const { sent, served } of pairs) {
    expect(sent ?? '').toMatch(HASH)
    expect(served).toBe(sent)
  }
})

test('E4 a screen whose code fails to load reloads once, then shows the 500 without a reference', async ({
  page,
}) => {
  await signInWithCode(page, IN_THREE)
  await expect(page).toHaveURL(/\/companies$/)
  const aborted = { count: 0 }
  await page.route(PICKER_CHUNK, (route) => {
    aborted.count++
    return route.abort()
  })
  const loads = countDocumentLoads(page)

  await page.goto('/companies')

  await expect(page.getByRole('heading', FAILED)).toBeVisible()
  expect(loads.count).toBe(2)
  // Chromium asks for a failed chunk twice per load, so only "at least once per load".
  expect(aborted.count).toBeGreaterThanOrEqual(2)
  await expect(page.getByText('Referencia')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible()
})

test('E5 R10 30 minutes after a new version shows, the notice offers to reload', async ({
  page,
}) => {
  const csp = cspErrors(page)
  await page.clock.install()
  await rewriteApi(page, () => ({ 'X-App-Version': NEW }))
  const firstAnswer = page.waitForResponse(isApi)

  await page.goto('/login')
  await firstAnswer
  await page.clock.fastForward('29:59')

  await expect(page.getByText(NOTICE)).toHaveCount(0)
  await page.clock.fastForward(1000)
  const notice = page.getByRole('status').filter({ hasText: NOTICE })
  await expect(notice).toBeVisible()
  await expect(notice.getByRole('button', { name: 'Recargar' })).toBeVisible()
  await expect(notice.getByRole('button', { name: /cerrar/i })).toHaveCount(0)
  await Promise.all([
    page.waitForEvent('load'),
    notice.getByRole('button', { name: 'Recargar' }).click(),
  ])
  expect(csp).toEqual([])
})

test('E6 R10 a minimum later than my build shows the blocking dialog, which reloads on its button', async ({
  page,
}) => {
  const csp = cspErrors(page)
  await rewriteApi(page, () => ({ 'X-Min-Client-Version': LATER }))

  await page.goto('/login')

  const dialog = page.getByRole('alertdialog', DIALOG)
  await expect(dialog).toBeVisible()
  await expect(
    dialog.getByText('Hay una versión nueva de worKampo y esta ya no se puede usar.'),
  ).toBeVisible()
  await expect(dialog.getByRole('button')).toHaveCount(1)
  await expect(dialog.getByRole('button', { name: 'Recargar' })).toBeFocused()
  // The page behind is inert: Tab never lands on one of its elements.
  for (const key of ['Tab', 'Shift+Tab']) {
    await page.keyboard.press(key)
    const insideOrNone = await page.evaluate(() => {
      const active = document.activeElement
      return !active || active === document.body || active.closest('dialog') !== null
    })
    expect(insideOrNone, key).toBe(true)
  }
  await page.keyboard.press('Escape')
  await page.mouse.click(5, 5)
  await expect(dialog).toBeVisible()
  await Promise.all([
    page.waitForEvent('load'),
    dialog.getByRole('button', { name: 'Recargar' }).click(),
  ])
  expect(csp).toEqual([])
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })

  test('E6 the dialog is a bottom sheet with a full-width 44 px button', async ({ page }) => {
    await rewriteApi(page, () => ({ 'X-Min-Client-Version': LATER }))

    await page.goto('/login')

    const dialog = page.getByRole('alertdialog', DIALOG)
    await expect(dialog).toBeVisible()
    const sheet = await dialog.boundingBox()
    const button = await dialog.getByRole('button', { name: 'Recargar' }).boundingBox()
    expect(sheet && sheet.y + sheet.height).toBeCloseTo(812, 0)
    expect(sheet?.width ?? 0).toBeCloseTo(375, 0)
    expect(button?.height ?? 0).toBeGreaterThanOrEqual(44)
    // Full width inside the sheet's padding.
    expect(button?.width ?? 0).toBeGreaterThanOrEqual((sheet?.width ?? 0) - 2 * 24)
  })
})

test('R9 index.html revalidates on / and a deep route, and a hashed asset is immutable', async ({
  request,
}) => {
  for (const path of ['/', '/companies']) {
    const response = await request.get(path)
    expect(response.status(), path).toBe(200)
    expect(response.headers()['cache-control'] ?? '', path).toMatch(
      /no-cache|max-age=0.*must-revalidate/,
    )
  }
  // The entry script of index.html, a hashed file under /assets/.
  const [entry] = (await (await request.get('/')).text()).match(/\/assets\/[^"]+\.js/) ?? []
  expect(entry).toBeDefined()
  const asset = await request.get(entry ?? '')
  expect(asset.status()).toBe(200)
  expect(asset.headers()['cache-control']).toContain('immutable')
})
