import { type APIRequestContext, expect, type Page, test } from '@playwright/test'
import {
  newEmail,
  SESSION_COOKIE,
  sessionToken,
  signInWithCode,
} from '../../../../e2e/support/acceptance-support'

test.use({ locale: 'es-ES' })

// Seed (packages/db/seed): linked@example.com owns Clínica Norte, Northwind and Sol Bakery.
const IN_THREE = 'linked@example.com'
const MOBILE = { width: 375, height: 812 }
// The shell's rail is 64 px wide (issue #92, "Anatomía").
const RAIL_WIDTH = 64

const random = () => crypto.randomUUID().slice(0, 8)
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

async function createCompany(
  api: APIRequestContext,
  { name, slug }: { name: string; slug: string },
) {
  const response = await api.post('/api/companies', {
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    data: { name, slug, defaultLanguage: 'es', userName: 'E2E' },
  })
  expect(response.status()).toBe(201)
}

// A new account that owns one company and is inside it, on its home.
async function openOwnCompany(page: Page, name = 'Northwind Logistics') {
  const email = newEmail()
  await signInWithCode(page, email)
  const slug = `e2e-northwind-${random()}`
  await createCompany(page.request, { name, slug })
  await page.goto(`/c/${slug}`)
  await expect(page.getByRole('heading', { name: `Bienvenido a ${name}` })).toBeVisible()
  return { email, slug }
}

test('@id:companies-92-1 the home shows the side menu with the company, my role and «Inicio» as current', async ({
  page,
}) => {
  await openOwnCompany(page)

  const company = page.getByRole('link', { name: /Northwind Logistics/ })
  await expect(company).toBeVisible()
  await expect(company).toContainText('Propietario')
  const home = page.getByRole('navigation').getByRole('link', { name: 'Inicio' })
  await expect(home).toBeVisible()
  await expect(home).toHaveAttribute('aria-current', 'page')
  await expect(
    page.getByRole('heading', { name: 'Bienvenido a Northwind Logistics' }),
  ).toBeVisible()
})

test('@id:companies-92-2 the menu shows nothing that does not exist yet', async ({ page }) => {
  await openOwnCompany(page)

  await expect(page.getByRole('searchbox')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /notificaciones/i })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /notificaciones/i })).toHaveCount(0)
  for (const text of ['Página pública', 'Ajustes', 'Ayuda', 'Mi cuenta'])
    await expect(page.getByText(text)).toHaveCount(0)
  await expect(page.getByText(/\bplan\b|prueba/i)).toHaveCount(0)
})

test('@id:companies-92-3 «Tus direcciones» shows the app address only', async ({ page }) => {
  const { slug } = await openOwnCompany(page)
  const { host } = new URL(page.url())

  await expect(page.getByRole('heading', { name: 'Tus direcciones' })).toBeVisible()
  await expect(page.getByText(`${host}/c/${slug}`)).toBeVisible()
  await expect(page.getByText('Página pública')).toHaveCount(0)
  const main = (await page.getByRole('main').textContent()) ?? ''
  expect(main.match(new RegExp(escapeRegExp(host), 'g'))).toHaveLength(1)
})

test('@id:companies-92-4 the company button leads to choose another one', async ({ page }) => {
  await signInWithCode(page, IN_THREE)
  await page.goto('/c/northwind')
  await expect(page.getByRole('heading', { name: 'Bienvenido a Northwind' })).toBeVisible()

  await page.getByRole('link', { name: /Northwind/ }).click()
  await expect(page).toHaveURL(/\/companies$/)
  await page.getByRole('link', { name: /Sol Bakery/ }).click()

  await expect(page).toHaveURL(/\/c\/sol-bakery\/?$/)
  await expect(page.getByRole('heading', { name: 'Bienvenido a Sol Bakery' })).toBeVisible()
})

test('@id:companies-92-5 signing out from the user menu revokes the session and leads to /login', async ({
  page,
  request,
}) => {
  await openOwnCompany(page)
  const token = await sessionToken(page)

  await page.getByRole('button', { name: /E2E/ }).click()
  await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click()

  await expect(page).toHaveURL(/\/login$/)
  const me = await request.get('/api/me', { headers: { Cookie: `${SESSION_COOKIE}=${token}` } })
  expect(me.status()).toBe(401)
})

test('@id:companies-92-6 on a phone the side menu opens over the page and Esc closes it, back on the menu button', async ({
  page,
}) => {
  await page.setViewportSize(MOBILE)
  await openOwnCompany(page)
  const open = page.getByRole('button', { name: 'Abrir menú' })

  await open.click()
  const menu = page.getByRole('dialog')
  await expect(menu).toBeVisible()
  await expect(menu.getByRole('link', { name: 'Inicio' })).toBeVisible()
  await page.keyboard.press('Escape')

  await expect(menu).toHaveCount(0)
  await expect(open).toBeFocused()
})

test('@id:companies-92-7 on a desktop the folded menu is a bar of icons, each keeping its name', async ({
  page,
}) => {
  await page.clock.install()
  await openOwnCompany(page)

  const fold = page.getByRole('button', { name: 'Plegar menú lateral' })
  await expect(fold).toBeVisible()
  await fold.click()
  await page.mouse.move(1000, 400)

  const nav = page.getByRole('navigation')
  await expect.poll(async () => (await nav.boundingBox())?.width).toBeLessThanOrEqual(RAIL_WIDTH)
  const items = nav.getByRole('link')
  expect(await items.count()).toBeGreaterThan(0)
  for (const item of await items.all()) await expect(item).toHaveAccessibleName(/\S/)
  await nav.getByRole('link', { name: 'Inicio' }).hover()
  // Past the rail's and the tooltip's delays, so a tooltip would be showing by now.
  await page.clock.runFor(1000)
  await expect(page.getByRole('tooltip')).toHaveCount(0)
})

test('@id:companies-92-8 an account without a name shows its email on the user button', async ({
  page,
}) => {
  // Creating a company gives the account a name, so the seed has no nameless member: /api/me
  // answers as it would for one.
  await page.route('**/api/me', async (route) => {
    const response = await route.fetch()
    const { name: _name, ...me } = (await response.json()) as Record<string, unknown>
    await route.fulfill({ response, json: me })
  })
  const { email } = await openOwnCompany(page)

  await expect(page.getByRole('button', { name: new RegExp(escapeRegExp(email)) })).toBeVisible()
  await expect(page.getByRole('button', { name: /E2E/ })).toHaveCount(0)
})

test('@id:companies-92-9 a long company name is cut with an ellipsis and read whole in a tooltip', async ({
  page,
}) => {
  const name = 'Cooperativa de Transportes y Logística del Noroeste Peninsular, Sociedad Anónima'
  expect(name).toHaveLength(80)
  await openOwnCompany(page, name)

  const company = page.getByRole('link', { name: new RegExp(escapeRegExp(name)) })
  const label = company.getByText(name, { exact: true })
  expect(
    await label.evaluate(
      (element) =>
        getComputedStyle(element).textOverflow === 'ellipsis' &&
        element.scrollWidth > element.clientWidth,
    ),
  ).toBe(true)
  await company.hover()

  await expect(page.getByRole('tooltip')).toContainText(name)
})

test('@id:companies-92-10 the first focus skips to the content and the tab names the page and the company', async ({
  page,
}) => {
  await openOwnCompany(page)

  await page.keyboard.press('Tab')

  await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused()
  await expect(page).toHaveTitle('Inicio · Northwind Logistics · worKampo')
})

test('@id:companies-92-11 a slow load shows the app loader, still with reduced motion', async ({
  page,
}) => {
  await signInWithCode(page, newEmail())
  const slug = `e2e-slow-${random()}`
  await createCompany(page.request, { name: 'Northwind Logistics', slug })
  await page.route(`**/api/t/${slug}/`, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2000))
    await route.continue()
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })

  await page.goto(`/c/${slug}`)

  const loader = page.getByRole('status', { name: 'Cargando' })
  await expect(loader).toBeVisible()
  expect(
    await loader.evaluate((element) =>
      [element, ...element.querySelectorAll('*')].every(
        (node) => getComputedStyle(node).animationName === 'none',
      ),
    ),
  ).toBe(true)
  await expect(
    page.getByRole('heading', { name: 'Bienvenido a Northwind Logistics' }),
  ).toBeVisible()
})

test('@id:companies-196-1 hovering the folded rail unfolds it over the page, and pinning it pushes the page', async ({
  page,
}) => {
  await openOwnCompany(page)
  const fold = page.getByRole('button', { name: 'Plegar menú lateral' })
  await expect(fold).toBeVisible()
  await fold.click()
  await page.mouse.move(1000, 400)
  const main = page.getByRole('main')
  await expect.poll(async () => (await main.boundingBox())?.x).toBeLessThan(256)
  const folded = (await main.boundingBox())?.x

  await page.getByRole('navigation').hover()

  const pin = page.getByRole('button', { name: 'Fijar menú lateral' })
  await expect(pin).toBeVisible()
  expect((await main.boundingBox())?.x).toBe(folded)
  await pin.click()

  await expect.poll(async () => (await main.boundingBox())?.x).toBeGreaterThanOrEqual(256)
  const collapse = page.getByRole('button', { name: 'Plegar menú lateral' })
  await expect(collapse).toBeVisible()
  const company = await page.getByRole('link', { name: /Northwind Logistics/ }).boundingBox()
  const button = await collapse.boundingBox()
  if (!company || !button) throw new Error('the company row is not laid out')
  // In the company's row: the button's middle lies within the company's height.
  expect(button.y + button.height / 2).toBeGreaterThan(company.y)
  expect(button.y + button.height / 2).toBeLessThan(company.y + company.height)
})

test('@id:companies-196-2 on a phone the side menu holds the company, the navigation and my user at the bottom', async ({
  page,
}) => {
  await page.setViewportSize(MOBILE)
  await openOwnCompany(page)

  const topbar = page.getByRole('banner')
  await expect(topbar.getByRole('button', { name: 'Abrir menú' })).toBeVisible()
  await expect(topbar.getByText('Northwind Logistics')).toBeVisible()
  await expect(topbar.getByRole('button', { name: /E2E/ })).toHaveCount(0)
  await topbar.getByRole('button', { name: 'Abrir menú' }).click()

  const menu = page.getByRole('dialog')
  await expect(menu.getByRole('link', { name: /Northwind Logistics/ })).toBeVisible()
  await expect(menu.getByRole('link', { name: 'Inicio' })).toBeVisible()
  const account = menu.getByRole('button', { name: /E2E/ })
  await expect(account).toBeVisible()
  const nav = await menu.getByRole('navigation').boundingBox()
  const user = await account.boundingBox()
  if (!nav || !user) throw new Error('the side menu is not laid out')
  expect(user.y).toBeGreaterThanOrEqual(nav.y + nav.height)
})

test('@id:companies-196-3 on a desktop Tab goes through the company, folding, the navigation and the user', async ({
  page,
}) => {
  await openOwnCompany(page)
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused()

  for (const stop of [
    page.getByRole('link', { name: /Northwind Logistics/ }),
    page.getByRole('button', { name: 'Plegar menú lateral' }),
    page.getByRole('navigation').getByRole('link', { name: 'Inicio' }),
    page.getByRole('button', { name: /E2E/ }),
  ]) {
    await page.keyboard.press('Tab')
    await expect(stop).toBeFocused()
  }
  // Past the user, Tab leaves the sidebar for the page; the company home has nothing focusable yet.
  await page.keyboard.press('Tab')

  expect(
    await page
      .getByRole('complementary')
      .evaluate((sidebar) => sidebar.contains(document.activeElement)),
  ).toBe(false)
})
