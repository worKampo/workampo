import { type APIRequestContext, expect, type Page, test } from '@playwright/test'
import { newEmail, signInWithCode } from '../../../../e2e/support/acceptance-support'

test.use({ locale: 'es-ES' })

// Seed (packages/db/seed): linked@example.com is in Clínica Norte, Northwind and Sol Bakery;
// renamed@example.com signs in as the user whose Sol Bakery membership is suspended.
const IN_THREE = 'linked@example.com'
const SUSPENDED_IN_SOL_BAKERY = 'renamed@example.com'
const SEEDED = ['Clínica Norte', 'Northwind', 'Sol Bakery']
const ROLE = /propietari|administrador|miembro|lector|owner|admin|member|viewer/i

const random = () => crypto.randomUUID().slice(0, 8)

async function createCompany(api: APIRequestContext, slug: string) {
  const response = await api.post('/api/companies', {
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    data: { name: `E2E ${slug}`, slug, defaultLanguage: 'es', userName: 'E2E' },
  })
  expect(response.status()).toBe(201)
}

// The picker's company links, in the order the page shows them.
async function pickerNames(page: Page, names: string[]) {
  const texts = await page
    .getByRole('link')
    .filter({ hasText: new RegExp(names.join('|')) })
    .allTextContents()

  return texts.map((text) => names.find((name) => text.includes(name)))
}

async function openPicker(page: Page) {
  await signInWithCode(page, IN_THREE)
  await expect(page).toHaveURL(/\/companies$/)
}

test('@id:companies-91-1 with only one company, signing in leads to it', async ({ page }) => {
  const email = newEmail()
  await signInWithCode(page, email)
  const slug = `e2e-northwind-${random()}`
  await createCompany(page.request, slug)
  await page.context().clearCookies()

  await signInWithCode(page, email)

  await expect(page).toHaveURL(new RegExp(`/c/${slug}/?$`))
  await expect(page.getByText(`Bienvenido a E2E ${slug}`)).toBeVisible()
})

test('@id:companies-91-2 with several companies I see the picker, in alphabetical order and without my role', async ({
  page,
}) => {
  await signInWithCode(page, IN_THREE)

  await expect(page).toHaveURL(/\/companies$/)
  await expect(page.getByText(/Has entrado como/)).toBeVisible()
  await expect(page.getByText(IN_THREE)).toBeVisible()
  expect(await pickerNames(page, SEEDED)).toEqual(SEEDED)
  for (const slug of ['clinica-norte', 'northwind', 'sol-bakery'])
    await expect(page.getByText(`/c/${slug}`)).toBeVisible()
  await expect(page.getByText(ROLE)).toHaveCount(0)
})

test('@id:companies-91-3 without any company, signing in leads to the creation form', async ({
  page,
}) => {
  await signInWithCode(page, newEmail())

  await expect(page).toHaveURL(/\/companies\/new$/)
  await expect(page.getByLabel('Nombre de la empresa')).toBeVisible()
})

test('@id:companies-91-4 choosing a company in the picker leads to it', async ({ page }) => {
  await openPicker(page)

  await page.getByRole('link', { name: /Sol Bakery/ }).click()

  await expect(page).toHaveURL(/\/c\/sol-bakery\/?$/)
  await expect(page.getByText('Bienvenido a Sol Bakery')).toBeVisible()
})

test('@id:companies-91-5 from the picker I reach the creation form and come back', async ({
  page,
}) => {
  await openPicker(page)

  await page.getByRole('link', { name: 'Crear una empresa nueva' }).click()
  await expect(page).toHaveURL(/\/companies\/new$/)
  await expect(page.getByLabel('Nombre de la empresa')).toBeVisible()
  await page.getByRole('link', { name: 'Volver a mis empresas' }).click()

  await expect(page).toHaveURL(/\/companies$/)
  expect(await pickerNames(page, SEEDED)).toEqual(SEEDED)
})

test('@id:companies-91-6 a suspended membership is not in the picker and its company answers 404', async ({
  page,
}) => {
  await signInWithCode(page, SUSPENDED_IN_SOL_BAKERY)
  // Its only active company is Cooperativa Agrícola Ñandú, so the sign-in goes straight there.
  await expect(page).toHaveURL(/\/c\/cooperativa-agricola-nandu\/?$/)

  await page.goto('/companies')
  await expect(page.getByRole('link', { name: /Cooperativa Agrícola Ñandú/ })).toBeVisible()
  await expect(page.getByText('Sol Bakery')).toHaveCount(0)

  await page.goto('/c/sol-bakery')
  await expect(page.getByRole('heading', { level: 1, name: 'Página no encontrada' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('href', '/')
  await expect(page.getByText('Bienvenido a Sol Bakery')).toHaveCount(0)
})

test('@id:companies-91-7 with a session, / leads where signing in leads', async ({ page }) => {
  const email = newEmail()
  await signInWithCode(page, email)
  await page.goto('/')
  await expect(page).toHaveURL(/\/companies\/new$/)

  const slug = `e2e-inicio-${random()}`
  await createCompany(page.request, slug)
  await page.goto('/')
  await expect(page).toHaveURL(new RegExp(`/c/${slug}/?$`))

  await createCompany(page.request, `e2e-inicio-otra-${random()}`)
  await page.goto('/')
  await expect(page).toHaveURL(/\/companies$/)
})

test('@id:companies-91-8 without a session, / leads to /login', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('button', { name: 'Continuar', exact: true })).toBeVisible()
})
