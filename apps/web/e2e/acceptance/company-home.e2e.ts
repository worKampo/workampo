import { type APIRequestContext, expect, type Page, test } from '@playwright/test'
import { newEmail, signInWithCode } from '../../../api/e2e/acceptance/support'

test.use({ locale: 'es-ES' })

const random = () => crypto.randomUUID().slice(0, 8)

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

// The page as a person reads it, with the slug blanked so two companies' pages compare.
const visibleText = async (page: Page, slug: string) =>
  ((await page.locator('body').textContent()) ?? '').replaceAll(slug, '<slug>')

test('@id:companies-90-1 the home of my company welcomes me with its name', async ({ page }) => {
  await signInWithCode(page, newEmail())
  const slug = `e2e-northwind-logistics-${random()}`
  await createCompany(page.request, { name: 'Northwind Logistics', slug })

  await page.goto(`/c/${slug}`)

  await expect(page.getByText('Bienvenido a Northwind Logistics')).toBeVisible()
})

test('@id:companies-90-1 a long name with unicode and markup is shown as text', async ({
  page,
}) => {
  await signInWithCode(page, newEmail())
  const slug = `e2e-unicode-${random()}`
  const name = 'Cooperativa Agrícola Ñandú <b>Ελλάδα</b> 日本 — Sociedad Limitada Unipersonal'
  await createCompany(page.request, { name, slug })

  await page.goto(`/c/${slug}`)

  await expect(page.getByText(`Bienvenido a ${name}`)).toBeVisible()
  await expect(page.locator('b', { hasText: 'Ελλάδα' })).toHaveCount(0)
})

test('@id:companies-90-12 another company looks the same as one that does not exist', async ({
  page,
  browser,
}) => {
  const other = await browser.newContext({
    ...baseUrl(),
    ignoreHTTPSErrors: true,
    locale: 'es-ES',
  })
  const otherPage = await other.newPage()
  await signInWithCode(otherPage, newEmail())
  const foreign = `e2e-sol-bakery-${random()}`
  await createCompany(otherPage.request, { name: 'E2E Sol Bakery', slug: foreign })
  await other.close()
  await signInWithCode(page, newEmail())
  await createCompany(page.request, { name: 'E2E Northwind', slug: `e2e-northwind-${random()}` })
  const missing = `e2e-missing-${random()}`

  await page.goto(`/c/${foreign}`)
  await expect(page.getByRole('heading').first()).toBeVisible()
  const foreignText = await visibleText(page, foreign)
  await page.goto(`/c/${missing}`)
  await expect(page.getByRole('heading').first()).toBeVisible()
  const missingText = await visibleText(page, missing)

  expect(foreignText).not.toContain('E2E Sol Bakery')
  expect(foreignText).not.toContain('Bienvenido')
  expect(foreignText).toBe(missingText)
})

test('@id:companies-90-13 without a session a company page leads to /login', async ({ page }) => {
  await page.goto('/c/northwind')

  await expect(page).toHaveURL(/\/login$/)
})

// The project's baseURL, for contexts made by hand, which do not inherit it.
function baseUrl() {
  const { baseURL } = test.info().project.use
  return baseURL ? { baseURL } : {}
}
