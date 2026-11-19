import { expect, test } from '@playwright/test'

test('GET /health answers 200 with status ok', async ({ request }) => {
  const response = await request.get('/health')
  expect(response.status()).toBe(200)
  expect(await response.json()).toMatchObject({ status: 'ok' })
})
