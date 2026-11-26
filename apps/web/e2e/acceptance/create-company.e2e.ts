import { type Browser, expect, type Locator, type Page, test } from '@playwright/test'
import { newEmail, signInWithCode } from '../../../../e2e/support/acceptance-support'

test.use({ locale: 'es-ES' })

// Companies that tests create carry e2e- and a random part, so runs never step on each other (ADR-0029).
const random = () => crypto.randomUUID().slice(0, 8)

const nameField = (page: Page) => page.getByLabel('Nombre de la empresa')
const slugField = (page: Page) => page.getByLabel(/URL/)
const userNameField = (page: Page) => page.getByLabel('Tu nombre')
const createButton = (page: Page) => page.getByRole('button', { name: 'Crear empresa' })
const AVAILABLE = /^Disponible/
const TAKEN = /^No disponible/

async function openForm(page: Page) {
  // A new account has no company, so signing in lands on the form.
  await signInWithCode(page, newEmail())
  await expect(page).toHaveURL(/\/companies\/new$/)
  await expect(nameField(page)).toBeVisible()
}

async function fillCompany(page: Page, { name, slug }: { name: string; slug?: string }) {
  await nameField(page).fill(name)
  if (slug !== undefined) await slugField(page).fill(slug)
  if (await userNameField(page).isVisible()) await userNameField(page).fill('E2E')
}

// Pressing create leaves me on the form and no company is created.
async function expectNotCreated(page: Page) {
  const created: string[] = []
  page.on('response', (r) => {
    if (r.url().endsWith('/api/companies') && r.status() === 201) created.push(r.url())
  })
  await createButton(page).click({ force: true })
  await page.waitForTimeout(1000)
  expect(created).toEqual([])
  await expect(page).toHaveURL(/\/companies\/new$/)
}

test('@id:companies-90-1 creating the first company leads to its home', async ({ page }) => {
  const suffix = random()
  const name = `E2E Northwind Logistics ${suffix}`
  await openForm(page)

  await fillCompany(page, { name })
  await expect(slugField(page)).toHaveValue(`e2e-northwind-logistics-${suffix}`)
  await expect(page.getByText(AVAILABLE)).toBeVisible()
  await createButton(page).click()

  await expect(page).toHaveURL(new RegExp(`/c/e2e-northwind-logistics-${suffix}/?$`))
  await expect(page.getByText(`Bienvenido a ${name}`)).toBeVisible()
})

test('@id:companies-90-2 the proposed URL comes from the name without accents and is available', async ({
  page,
}) => {
  const suffix = random()
  await openForm(page)

  await nameField(page).fill(`E2E Clínica Norte ${suffix}`)

  await expect(slugField(page)).toHaveValue(`e2e-clinica-norte-${suffix}`)
  await expect(page.getByText(AVAILABLE)).toBeVisible()
})

test('@id:companies-90-3 a URL another company has is not available', async ({ page, browser }) => {
  const slug = `e2e-clinica-norte-${random()}`
  await createElsewhere(browser, slug)
  await openForm(page)

  await fillCompany(page, { name: 'E2E Clínica Norte', slug })

  await expect(page.getByText(TAKEN)).toBeVisible()
  await expectNotCreated(page)
})

test('@id:companies-90-4 a reserved URL cannot be used', async ({ page }) => {
  await openForm(page)

  await fillCompany(page, { name: 'E2E Reservada', slug: 'api' })

  await expect(page.getByText(/reservad/i)).toBeVisible()
  await expectNotCreated(page)
})

for (const slug of ['ab', 'mi--empresa', '-norte', 'norte-stg']) {
  test(`@id:companies-90-5 the URL "${slug}" has an invalid format`, async ({ page }) => {
    await openForm(page)

    await fillCompany(page, { name: 'E2E Formato', slug })

    await expect(page.getByText(/^Usa de 3 a 40 caracteres/)).toBeVisible()
    await expectNotCreated(page)
  })
}

test('@id:companies-90-6 the form has no terms checkbox', async ({ page }) => {
  await openForm(page)

  await expect(page.getByRole('checkbox')).toHaveCount(0)
  await expect(page.getByText(/términos|condiciones|DPA/i)).toHaveCount(0)
})

test('@id:companies-90-7 the chosen default language is sent with the company', async ({
  page,
}) => {
  await openForm(page)
  await fillCompany(page, { name: `E2E Idioma ${random()}` })

  await page.getByLabel('Idioma por defecto').selectOption({ label: 'Español' })
  const [sent] = await Promise.all([
    page.waitForRequest((r) => r.url().endsWith('/api/companies') && r.method() === 'POST'),
    createButton(page).click(),
  ])

  expect(sent.postDataJSON()).toMatchObject({ defaultLanguage: 'es' })
  await expect(page).toHaveURL(/\/c\/e2e-idioma-/)
})

test('@id:companies-90-8 an account without a name gives it when creating', async ({ page }) => {
  await openForm(page)

  await expect(userNameField(page)).toBeVisible()
  await nameField(page).fill(`E2E Ana ${random()}`)
  await userNameField(page).fill('Ana')
  await createButton(page).click()

  await expect(page).toHaveURL(/\/c\/e2e-ana-/)
  const me = await page.request.get('/api/me')
  expect(await me.json()).toMatchObject({ name: 'Ana' })
})

test('@id:companies-90-9 an account with a name is not asked for it', async ({ page }) => {
  await openForm(page)
  await nameField(page).fill(`E2E Primera ${random()}`)
  await userNameField(page).fill('Ana')
  await createButton(page).click()
  await expect(page).toHaveURL(/\/c\/e2e-primera-/)

  await page.goto('/companies/new')

  await expect(nameField(page)).toBeVisible()
  await expect(userNameField(page)).toHaveCount(0)
})

test('@id:companies-90-10 of two people sending the same URL at once, the other sees it is not available', async ({
  browser,
}) => {
  const slug = `e2e-sol-${random()}`
  const pages = await Promise.all([newPage(browser), newPage(browser)])
  for (const page of pages) {
    await openForm(page)
    await fillCompany(page, { name: 'E2E Sol', slug })
    await expect(page.getByText(AVAILABLE)).toBeVisible()
  }

  await Promise.all(pages.map((page) => createButton(page).click()))

  const outcomes = await Promise.all(
    pages.map((page) =>
      Promise.race([
        page.waitForURL(new RegExp(`/c/${slug}/?$`)).then(() => 'created'),
        page
          .getByText(TAKEN)
          .waitFor()
          .then(() => 'taken'),
      ]),
    ),
  )
  expect(outcomes.sort()).toEqual(['created', 'taken'])
})

test('@id:companies-166-1 without a company I see what a company is above the form', async ({
  page,
}) => {
  await openForm(page)

  const intro = page.getByText(/^Una empresa es el espacio de tu equipo en worKampo/)
  await expect(intro).toBeVisible()
  await expect(intro).toContainText('Serás su propietario')
  expect(await isAbove(intro, page.locator('form'))).toBe(true)
})

test('@id:companies-166-2 the URL shows its prefix and a hint before any error', async ({
  page,
}) => {
  await openForm(page)

  const prefix = page.getByText('…/c/', { exact: true })
  await expect(prefix).toBeVisible()
  const [prefixBox, slugBox] = await Promise.all([
    prefix.boundingBox(),
    slugField(page).boundingBox(),
  ])
  expect(prefixBox && slugBox && prefixBox.x + prefixBox.width <= slugBox.x + 1).toBe(true)
  await expect(
    page.getByText('Minúsculas, números y guiones; algunos nombres están reservados.'),
  ).toBeVisible()
  await expect(slugField(page)).not.toHaveAttribute('aria-invalid', 'true')
})

test('@id:companies-166-3 a free URL shows "Disponible" in the positive colour', async ({
  page,
}) => {
  await openForm(page)

  await nameField(page).fill(`E2E Verde ${random()}`)

  const available = page.getByText(AVAILABLE)
  await expect(available).toBeVisible()
  expect(await colourOf(available)).toBe(await tokenColour(page, '--pos'))
})

test('@id:companies-166-4 while creating, the button keeps focus and says "Creando…"', async ({
  page,
}) => {
  let release = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/companies', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    await held
    return route.continue()
  })
  await openForm(page)
  await fillCompany(page, { name: `E2E Creando ${random()}` })
  await expect(page.getByText(AVAILABLE)).toBeVisible()

  await createButton(page).click()

  const busy = page.getByRole('button', { name: 'Creando…' })
  await expect(busy).toBeFocused()
  await expect(busy).toHaveAttribute('aria-busy', 'true')
  release()
  await expect(page).toHaveURL(/\/c\/e2e-creando-/)
})

test('@id:companies-166-5 a server rejection shows in a negative banner above the form', async ({
  page,
}) => {
  await page.route('**/api/companies', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({
          status: 500,
          contentType: 'application/problem+json',
          body: JSON.stringify({ type: 'about:blank', status: 500, code: 'internal' }),
        })
      : route.fallback(),
  )
  await openForm(page)
  await fillCompany(page, { name: `E2E Rechazo ${random()}` })
  await expect(page.getByText(AVAILABLE)).toBeVisible()

  await createButton(page).click()

  const banner = page.locator('form > [role="alert"]:first-child')
  await expect(banner).toBeVisible()
  await expect(banner).toBeFocused()
  await expect(page).toHaveURL(/\/companies\/new$/)
})

// `a` ends above where `b` starts on the page.
async function isAbove(a: Locator, b: Locator) {
  const [boxA, boxB] = await Promise.all([a.boundingBox(), b.boundingBox()])
  return !!boxA && !!boxB && boxA.y + boxA.height <= boxB.y + 1
}

const colourOf = (locator: Locator) => locator.evaluate((el) => getComputedStyle(el).color)

// The computed colour of a design token, read from a probe so both sides use the same format.
function tokenColour(page: Page, token: string) {
  return page.evaluate((name) => {
    const probe = document.createElement('span')
    probe.style.color = `var(${name})`
    document.body.appendChild(probe)
    const colour = getComputedStyle(probe).color
    probe.remove()
    return colour
  }, token)
}

// Another person, in their own browser, takes `slug` first.
async function createElsewhere(browser: Browser, slug: string) {
  const page = await newPage(browser)
  await openForm(page)
  await fillCompany(page, { name: 'E2E Clínica Norte', slug })
  await expect(page.getByText(AVAILABLE)).toBeVisible()
  await createButton(page).click()
  await expect(page).toHaveURL(new RegExp(`/c/${slug}/?$`))
  await page.context().close()
}

// A second browser of its own: contexts made by hand do not take test.use()'s locale.
async function newPage(browser: Browser) {
  const context = await browser.newContext({
    ...baseUrl(),
    ignoreHTTPSErrors: true,
    locale: 'es-ES',
  })
  return context.newPage()
}

// The project's baseURL, for contexts made by hand, which do not inherit it.
function baseUrl() {
  const { baseURL } = test.info().project.use
  return baseURL ? { baseURL } : {}
}
